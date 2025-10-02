"use strict";

const fastifyWebSockets = require("@fastify/websocket");
const cors = require("@fastify/cors");
const path = require("node:path");
const AutoLoad = require("@fastify/autoload");
const { loadBootstrapServers } = require("./utilities/bootstrap-loader");
const connectionRegistry = require("./utilities/connection-registry");
const {
  connectToIntroducers,
  resolveServerJoinPayload,
} = require("./utilities/server-join");
const {
  resolveServerKeyOptions,
  loadServerKeyPair,
} = require("./utilities/server-keys");

// Pass --options via CLI arguments in command to enable these options.
const options = {};

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  let serverIdentity;
  try {
    const keyOptions = resolveServerKeyOptions({ options: opts });
    serverIdentity = await loadServerKeyPair(keyOptions);
    fastify.decorate("serverIdentity", serverIdentity);
    fastify.log.info(
      { keyId: serverIdentity.keyId, directory: serverIdentity.directory },
      "Loaded server key pair",
    );
  } catch (error) {
    fastify.log.error(error, "Unable to load server key pair");
    throw error;
  }

  const bootstrapServers = loadBootstrapServers();
  fastify.decorate("bootstrapServers", bootstrapServers);
  fastify.decorate("serverJoinPayload", null);
  fastify.log.info({ bootstrapServers }, "Loaded bootstrap servers");

  fastify.addHook("onListen", function (done) {
    let finished = false;
    const finalize = () => {
      if (!finished) {
        finished = true;
        done();
      }
    };

    const handleError = (error) => {
      fastify.log.error(
        error,
        "Failed to send SERVER_HELLO_JOIN to introducers",
      );
      finalize();
    };

    if (!Array.isArray(bootstrapServers) || bootstrapServers.length === 0) {
      fastify.log.warn(
        "No bootstrap servers configured; skipping join request",
      );
      finalize();
      return;
    }

    const joinPayload = resolveServerJoinPayload({
      fastify,
      serverIdentity,
      preferDecorated: false,
    });

    if (!joinPayload) {
      fastify.log.error("Unable to resolve join payload; skipping introducers");
      finalize();
      return;
    }

    fastify.serverJoinPayload = joinPayload;

    try {
      connectToIntroducers({
        bootstrapServers,
        joinPayload,
        connectionRegistry,
        logger: fastify.log,
        from: process.env.SERVER_ID || "G29_SERVER",
        serverIdentity,
        fastify,
      })
        .then((result) => {
          fastify.log.info(
            { joinPayload, result },
            "Dispatched SERVER_HELLO_JOIN to introducers",
          );
          finalize();
        })
        .catch(handleError);
    } catch (error) {
      handleError(error);
    }
  });

  // Do not touch the following lines

  // Register WebSocket plugin BEFORE loading routes so that
  // routes can declare `{ websocket: true }` correctly.
  fastify.register(fastifyWebSockets);

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    options: Object.assign({}, opts),
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, "routes"),
    options: Object.assign({}, opts),
  });

  fastify.register(cors);
};

module.exports.options = options;
