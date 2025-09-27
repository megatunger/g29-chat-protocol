"use strict";

const { send } = require("../utilities/message-utils");

const DEFAULT_SERVER_ID = "G29_SERVER_V0";
const HEARTBEAT_ACK_SIG = "";

module.exports = async function HEARTBEAT({ socket, data }) {
  const now = Date.now();
  socket.__lastHeartbeatAt = now;

  const from = DEFAULT_SERVER_ID;
  const to = typeof data?.from === "string" && data.from.length > 0 ? data.from : DEFAULT_SERVER_ID;
  const payload = (data && typeof data.payload === "object" && data.payload !== null)
    ? data.payload
    : {};

  send(socket, {
    type: "HEARTBEAT",
    from,
    to,
    payload,
    sig: HEARTBEAT_ACK_SIG,
  });
};
