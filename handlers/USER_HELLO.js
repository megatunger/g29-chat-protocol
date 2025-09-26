"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const defaultRegistry = require("../utilities/connection-registry");

const prisma = new PrismaClient();

module.exports = async function USER_HELLO(props) {
  const { socket, data, meta, connectionRegistry = defaultRegistry } = props;
  console.log("[USER_HELLO] Request: ", data);
  
  if (!data.payload) {
    throw new Error("Missing payload");
  }

  if (!data.from) {
    throw new Error("Missing userID in 'from' field");
  }

  try {
    await prisma.client.upsert({
      where: {
        userID: data.from,
      },
      update: {
        pubkey: data.payload.pubkey,
        version: data.payload.client || "unknown",
        isActive: true, 
        ts: new Date(),
      },
      create: {
        userID: data.from,
        pubkey: data.payload.pubkey,
        version: data.payload.client || "unknown", 
        isActive: true,  
      },
    });

    connectionRegistry.registerUserConnection(data.from, socket);
    console.log(`✅ User ${data.from} is now ACTIVE in database`);

    send(socket, {
      type: "ACK",
      from: "server",
      to: data.from,
      payload: {
        message: "Welcome to the chat!",
      },
    });
    if (!socket.__userStatusCleanup) {
      socket.__userStatusCleanup = true;
      socket.on("close", async () => {
        const userId = connectionRegistry.getUserIdBySocket(socket) || data.from;
        connectionRegistry.unregisterSocket(socket);
        if (!userId) {
          return;
        }
        try {
          await prisma.client.update({
            where: { userID: userId },
            data: { isActive: false },
          });
          console.log(`User ${userId} is now INACTIVE (disconnected)`);
        } catch (error) {
          console.error(error);
        }
      });
    }

  } catch (error) {
    console.error("Database error:", error);
    throw new Error(`Failed to store user: ${error.message}`);
  }
};
