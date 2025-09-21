"use strict";

const { send, sendTyped } = require("../routes/chat/message-utils");

module.exports = async function handlePing({ socket, meta }) {
  if (meta && meta.source === "legacy") {
    send(socket, "pong");
    return;
  }

  sendTyped(socket, "pong", { timestamp: Date.now() });
};
