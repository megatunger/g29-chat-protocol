"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

module.exports = async function SERVER_HELLO_JOIN(props) {
  const { socket, data, meta } = props;
  console.log("[SERVER_HELLO_JOIN] Request: ", data);
  if (!data.payload) {
    throw new Error("Missing payload");
  }
  const rawPort = data.payload.port;
  let port = null;
  if (rawPort !== undefined && rawPort !== null && rawPort !== "") {
    const parsedPort =
      typeof rawPort === "number" ? rawPort : Number.parseInt(rawPort, 10);
    if (!Number.isInteger(parsedPort)) {
      throw new Error("Invalid port in SERVER_HELLO_JOIN payload");
    }
    port = parsedPort;
  }

  await prisma.client.create({
    data: {
      pubkey: data.payload.pubkey,
      host: data.payload.host,
      port,
      name: data.payload.name,
    },
  });
  send(socket, {
    type: "SERVER_WELCOME",
  });
};
