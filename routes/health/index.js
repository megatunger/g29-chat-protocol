"use strict";

module.exports = async function (fastify, opts) {
  fastify.get(
    "/",
    {
      websocket: true,
    },
    (connection, req) => {
      connection.socket.on("message", (msg) => {
        connection.socket.send(`Hello from Fastify. Your message is ${msg}`);
      });
      // Keep the connection open; do not return a value here.
      // Optionally, send a greeting once open.
      connection.socket.send("WebSocket connection established");
    }
  );
};
