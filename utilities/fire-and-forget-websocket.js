"use strict";

const WebSocket = require("ws");
const { send } = require("./message-utils");

function normalizeWebSocketUrl(address) {
  if (typeof address !== "string") {
    return null;
  }

  const trimmed = address.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }

  return `ws://${trimmed}`;
}

function fireAndForgetWebsocketSend({ url, message, timeout = 5000, logger }) {
  return new Promise((resolve) => {
    const targetUrl = normalizeWebSocketUrl(url);
    if (!targetUrl) {
      if (logger?.warn) {
        logger.warn({ url }, "fireAndForgetWebsocketSend invalid url");
      }
      resolve(false);
      return;
    }

    let settled = false;
    let timeoutId = null;
    let socket;

    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      try {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      } catch (_error) {
        // ignore close errors
      }
      resolve(result);
    };

    try {
      socket = new WebSocket(targetUrl);
    } catch (error) {
      if (logger?.error) {
        logger.error({ err: error, url: targetUrl }, "Failed to open forward websocket");
      }
      settle(false);
      return;
    }

    timeoutId = setTimeout(() => {
      if (logger?.warn) {
        logger.warn({ url: targetUrl }, "fireAndForgetWebsocketSend timeout");
      }
      settle(false);
    }, timeout);

    if (typeof timeoutId?.unref === "function") {
      timeoutId.unref();
    }

    let sendError = null;

    socket.once("open", () => {
      try {
        send(socket, message);
      } catch (error) {
        sendError = error;
        if (logger?.error) {
          logger.error(
            { err: error, url: targetUrl },
            "Failed to send forward websocket message",
          );
        }
      }
      try {
        socket.close();
      } catch (_error) {
        // ignore
      }
      if (sendError) {
        settle(false);
      }
    });

    socket.once("error", (error) => {
      if (logger?.error) {
        logger.error({ err: error, url: targetUrl }, "Forward websocket error");
      }
      settle(false);
    });

    socket.once("close", () => {
      if (!sendError) {
        settle(true);
      }
    });
  });
}

module.exports = {
  fireAndForgetWebsocketSend,
  normalizeWebSocketUrl,
};
