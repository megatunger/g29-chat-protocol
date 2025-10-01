"use strict";

const fastifyWebSockets = require("@fastify/websocket");
const cors = require("@fastify/cors");
const path = require("node:path");
const AutoLoad = require("@fastify/autoload");
const { loadBootstrapServers } = require("./utilities/bootstrap-loader");
const connectionRegistry = require("./utilities/connection-registry");
const { connectToIntroducers } = require("./utilities/server-join");

// Pass --options via CLI arguments in command to enable these options.
const options = {};

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  const bootstrapServers = loadBootstrapServers();
  fastify.decorate("bootstrapServers", bootstrapServers);
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
      fastify.log.error(error, "Failed to send SERVER_HELLO_JOIN to introducers");
      finalize();
    };

    if (!Array.isArray(bootstrapServers) || bootstrapServers.length === 0) {
      fastify.log.warn("No bootstrap servers configured; skipping join request");
      finalize();
      return;
    }

    const addressInfo = typeof fastify.server?.address === "function"
      ? fastify.server.address()
      : null;

    const parsedAddress = (() => {
      if (!addressInfo) {
        return null;
      }

      if (typeof addressInfo === "string") {
        try {
          const url = new URL(addressInfo);
          return {
            host: url.hostname,
            port: Number.parseInt(url.port, 10),
          };
        } catch (_error) {
          return null;
        }
      }

      if (typeof addressInfo === "object") {
        return {
          host: addressInfo.address || "localhost",
          port: addressInfo.port,
        };
      }

      return null;
    })();

    const defaultHost = process.env.SERVER_PUBLIC_HOST || "localhost";
    const hostCandidate = parsedAddress?.host;
    const host =
      hostCandidate && hostCandidate !== "::" && hostCandidate !== "0.0.0.0"
        ? hostCandidate
        : defaultHost;

    const portCandidates = [
      Number.parseInt(process.env.SERVER_PUBLIC_PORT || "", 10),
      typeof parsedAddress?.port === "number" ? parsedAddress.port : null,
      Number.parseInt(parsedAddress?.port, 10),
      Number.parseInt(process.env.PORT || "", 10),
      3000,
    ];

    const port =
      portCandidates.find(
        (value) => Number.isInteger(value) && value > 0 && value <= 65535,
      ) ?? 3000;

    const joinPayload = {
      host,
      port,
      pubkey: process.env.SERVER_PUBLIC_KEY || "UNSPECIFIED", // placeholder until real key management
    };

    try {
      connectToIntroducers({
        bootstrapServers,
        joinPayload,
        connectionRegistry,
        logger: fastify.log,
        from: process.env.SERVER_ID || "G29_SERVER",
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
