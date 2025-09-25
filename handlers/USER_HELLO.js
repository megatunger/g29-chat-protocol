"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

module.exports = async function SERVER_HELLO_JOIN(props) {
  const { socket, data, meta } = props;
  console.log("[HELLO_JOIN] Request: ", data);
  if (!data.payload) {
    throw new Error("Missing payload");
  }

  await prisma.client.create({
    data: {
      pubkey: data.payload.pubkey,
      userID: data.from,
      version: data.payload.client,
    },
  });

  send(socket, {
    type: "ACK",
  });
};
