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

  fastify.addHook("onListen", function (_server, address, done) {
    const finalize = () => done();
    const handleError = (error) => {
      fastify.log.error(error, "Failed to send SERVER_HELLO_JOIN to introducers");
      finalize();
    };

    if (!Array.isArray(bootstrapServers) || bootstrapServers.length === 0) {
      fastify.log.warn("No bootstrap servers configured; skipping join request");
      finalize();
      return;
    }

    const parsedAddress = (() => {
      if (typeof address === "string") {
        try {
          const url = new URL(address);
          return { host: url.hostname, port: Number.parseInt(url.port, 10) };
        } catch (_error) {
          return {
            host: "localhost",
            port: Number.parseInt(process.env.PORT || "3000", 10),
          };
        }
      }

      if (address && typeof address === "object") {
        return {
          host: address.address || "localhost",
          port: address.port,
        };
      }

      return {
        host: "localhost",
        port: Number.parseInt(process.env.PORT || "3000", 10),
      };
    })();

    const host = process.env.SERVER_PUBLIC_HOST || parsedAddress.host || "localhost";
    const portFromEnv = Number.parseInt(process.env.SERVER_PUBLIC_PORT || "", 10);
    const port = Number.isInteger(portFromEnv)
      ? portFromEnv
      : Number.parseInt(parsedAddress.port, 10) || parsedAddress.port || 0;

    const joinPayload = {
      host,
      port,
      pubkey: process.env.SERVER_PUBLIC_KEY || "UNSPECIFIED", // placeholder until real key management
    };

    connectToIntroducers({
      bootstrapServers,
      joinPayload,
      connectionRegistry,
      logger: fastify.log,
      from: process.env.SERVER_ID || "G29_SERVER",
    })
      .then((result) => {
        fastify.log.info({ joinPayload, result }, "Dispatched SERVER_HELLO_JOIN to introducers");
        finalize();
      })
      .catch(handleError);
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
