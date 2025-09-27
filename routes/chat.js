"use strict";

const { getHandler } = require("../handlers");
const { parseMessage, sendError } = require("../utilities/message-utils");
const connectionRegistry = require("../utilities/connection-registry");

const HEARTBEAT_TIMEOUT_MS = 45_000;
const HEARTBEAT_CHECK_INTERVAL_MS = 5_000;

module.exports = async function (fastify) {
  fastify.get(
    "/chat",
    {
      websocket: true,
    },
    (socket, req) => {
      fastify.log.info({ address: req.ip }, "Client connected");

      socket.__lastHeartbeatAt = Date.now();
      const clearHeartbeatMonitor = () => {
        if (socket.__heartbeatCheck) {
          clearInterval(socket.__heartbeatCheck);
          socket.__heartbeatCheck = null;
        }
      };

      socket.__heartbeatCheck = setInterval(() => {
        const lastHeartbeat = socket.__lastHeartbeatAt || 0;
        const elapsed = Date.now() - lastHeartbeat;
        if (elapsed > HEARTBEAT_TIMEOUT_MS) {
          fastify.log.warn(
            {
              address: req.ip,
              elapsed,
            },
            "Closing connection after heartbeat timeout",
          );
          clearHeartbeatMonitor();
          try {
            socket.close(4000, "heartbeat timeout");
          } catch (error) {
            fastify.log.error(error, "Failed to close socket after heartbeat timeout");
          }
        }
      }, HEARTBEAT_CHECK_INTERVAL_MS);

      socket.on("message", async (rawMessage) => {
        socket.__lastHeartbeatAt = Date.now();
        const parsed = parseMessage(rawMessage);
        if (parsed.error) {
          sendError(socket, "bad_request", parsed.error);
          return;
        }

        const handler = getHandler(parsed.type);
        if (!handler) {
          sendError(
            socket,
            "UNKNOWN_TYPE",
            `Unsupported message type: ${parsed.type}`,
          );
          return;
        }

        try {
          // A small delay to make things cool
          await new Promise((resolve, reject) => setTimeout(resolve, 400));
          await handler({
            socket,
            data: parsed,
            meta: parsed.meta,
            fastify,
            req,
            connectionRegistry,
          });
        } catch (error) {
          fastify.log.error(error, "WebSocket handler failed");
          sendError(
            socket,
            "INTERNAL_ERROR",
            error?.message ||
              error?.toString() ||
              "Unexpected error while processing message",
          );
        }
      });

      socket.on("close", () => {
        clearHeartbeatMonitor();
        connectionRegistry.unregisterSocket(socket);
        fastify.log.info({ address: req.ip }, "Client disconnected");
      });

      socket.on("error", (error) => {
        clearHeartbeatMonitor();
        fastify.log.error(error, "WebSocket connection error");
      });
    },
  );
};
