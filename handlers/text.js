"use strict";

const { send } = require("../utilities/message-utils");

module.exports = async function handleText({ socket, data, meta }) {
  if (meta && meta.source === "legacy") {
    send(socket, data);
    return;
  }

  send(socket, {
    type: "text",
    echo: data,
  });
};
