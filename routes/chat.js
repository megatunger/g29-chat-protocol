"use strict";

const { getHandler } = require("../handlers");
const { parseMessage, sendError } = require("./chat/message-utils");

module.exports = async function (fastify) {
  fastify.get(
    "/chat",
    {
      websocket: true,
    },
    (socket, req) => {
      fastify.log.info({ address: req.ip }, "Client connected");

      socket.on("message", async (rawMessage) => {
        const parsed = parseMessage(rawMessage);
        if (parsed.error) {
          sendError(socket, "bad_request", parsed.error);
          return;
        }

        const handler = getHandler(parsed.type);
        if (!handler) {
          sendError(
            socket,
            "unknown_type",
            `Unsupported message type: ${parsed.type}`,
          );
          return;
        }

        try {
          await handler({
            socket,
            data: parsed.data,
            meta: parsed.meta,
            fastify,
            req,
          });
        } catch (error) {
          fastify.log.error(error, "WebSocket handler failed");
          sendError(
            socket,
            "internal_error",
            "Unexpected error while processing message",
          );
        }
      });

      socket.on("close", () => {
        fastify.log.info({ address: req.ip }, "Client disconnected");
      });

      socket.on("error", (error) => {
        fastify.log.error(error, "WebSocket connection error");
      });
    },
  );
};
