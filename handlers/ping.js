"use strict";

const { send } = require("../utilities/message-utils");

module.exports = async function handlePing({ socket, meta }) {
  if (meta && meta.source === "legacy") {
    send(socket, "pong");
    return;
  }

  send(socket, "pong");
};
