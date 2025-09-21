"use strict";

module.exports = async function (fastify, opts) {
  fastify.get(
    "/chat",
    {
      websocket: true,
    },
    (socket, req) => {
      console.log("Client connected");
      console.log(socket);
      socket.on("message", (_message) => {
        const message = _message.toString("utf8");
        if (message === "ping") {
          socket.send("pong");
        } else {
          console.log(`Client message: ${message}`);
          socket.send(message.toString("utf8"));
        }
      });
      // Client disconnect
      socket.on("close", () => {
        console.log("Client disconnected");
      });
    },
  );
};
