"use strict";

const { signPayload } = require("./crypto");

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
      ...parsed,
      // meta: {
      //   raw,
      //   source: "json",
      // },
    };
  } catch (_error) {
    if (payload === "ping") {
      return {
        type: "ping",
        data: null,
        meta: {
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

  socket.send(
    JSON.stringify({
      ...message,
      ts: Date.now(),
    }),
  );
}

function prepareServerMessageEnvelope({ message, serverIdentity }) {
  if (!message || typeof message !== "object") {
    throw new Error("prepareServerMessageEnvelope requires a message object");
  }

  const payload = message.payload ?? {};
  let signature = "";

  if (serverIdentity?.privateKey) {
    signature = signPayload({ privateKey: serverIdentity.privateKey, payload });
  }

  return {
    ...message,
    sig: signature,
  };
}

function sendServerMessage({ socket, message, serverIdentity }) {
  const envelope = prepareServerMessageEnvelope({
    message,
    serverIdentity,
  });

  send(socket, envelope);
}

function sendError(socket, code, message) {
  send(socket, {
    type: "ERROR",
    ts: Date.now(),
    payload: {
      code,
      detail: message,
    },
  });
}

module.exports = {
  parseMessage,
  send,
  sendError,
  prepareServerMessageEnvelope,
  sendServerMessage,
};
