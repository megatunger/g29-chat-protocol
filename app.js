"use strict";

const fastifyWebSockets = require("@fastify/websocket");
const cors = require("@fastify/cors");
const path = require("node:path");
const AutoLoad = require("@fastify/autoload");
const { loadBootstrapServers } = require("./utilities/bootstrap-loader");

// Pass --options via CLI arguments in command to enable these options.
const options = {};

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  const bootstrapServers = loadBootstrapServers();
  fastify.decorate("bootstrapServers", bootstrapServers);
  fastify.log.info({ bootstrapServers }, "Loaded bootstrap servers");

  // TODO: Send New Server -> Introducer (Network Join Request) using bootstrapServers

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
