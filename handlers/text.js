"use strict";

const { send, sendTyped } = require("../routes/chat/message-utils");

module.exports = async function handleText({ socket, data, meta }) {
  if (meta && meta.source === "legacy") {
    send(socket, data);
    return;
  }

  sendTyped(socket, "text", {
    echo: data,
  });
};
