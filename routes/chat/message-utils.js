"use strict";

function toUtf8String(raw) {
  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (raw && typeof raw.toString === "function") {
    return raw.toString();
  }
  return "";
}

function parseMessage(raw) {
  const payload = toUtf8String(raw).trim();

  if (!payload) {
    return { error: "Empty message" };
  }

  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null) {
      return { error: "Invalid message format" };
    }
    if (typeof parsed.type !== "string" || !parsed.type) {
      return { error: "Missing message type" };
    }
    return {
      type: parsed.type,
      data: parsed.data ?? null,
      meta: {
        raw,
        source: "json",
      },
    };
  } catch (_error) {
    if (payload === "ping") {
      return {
        type: "ping",
        data: null,
        meta: {
          raw,
          source: "legacy",
        },
      };
    }

    return {
      type: "text",
      data: payload,
      meta: {
        raw,
        source: "legacy",
      },
    };
  }
}

function send(socket, message) {
  if (!socket || typeof socket.send !== "function") {
    return;
  }

  if (typeof message === "string" || Buffer.isBuffer(message)) {
    socket.send(message);
    return;
  }

  socket.send(JSON.stringify(message));
}

function sendTyped(socket, type, data) {
  send(socket, {
    type,
    data,
  });
}

function sendError(socket, code, message) {
  sendTyped(socket, "error", {
    code,
    message,
  });
}

module.exports = {
  parseMessage,
  send,
  sendTyped,
  sendError,
};
