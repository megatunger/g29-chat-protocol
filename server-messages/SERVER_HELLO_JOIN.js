"use strict";

function buildServerHelloJoinMessage({ from, to, payload }) {
  if (!payload || typeof payload !== "object") {
    throw new Error("SERVER_HELLO_JOIN message requires a payload object");
  }

  const { host, port, pubkey } = payload;

  if (!host || typeof host !== "string") {
    throw new Error("SERVER_HELLO_JOIN payload requires a host string");
  }

  if (typeof port !== "number" || Number.isNaN(port)) {
    throw new Error("SERVER_HELLO_JOIN payload requires a numeric port");
  }

  if (!pubkey || typeof pubkey !== "string") {
    throw new Error("SERVER_HELLO_JOIN payload requires a pubkey string");
  }

  return {
    type: "SERVER_HELLO_JOIN",
    from,
    to,
    ts: Date.now(),
    payload: {
      host,
      port,
      pubkey,
    },
  };
}

module.exports = {
  buildServerHelloJoinMessage,
};
