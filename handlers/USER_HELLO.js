"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const defaultRegistry = require("../utilities/connection-registry");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");

const prisma = new PrismaClient();

module.exports = async function USER_HELLO(props) {
  const { socket, data, meta, connectionRegistry = defaultRegistry } = props;
  console.log("[USER_HELLO] Request: ");

  if (!data.payload) {
    throw new Error("Missing payload");
  }

  if (!data.from) {
    throw new Error("Missing userID in 'from' field");
  }

  try {
    const user = await prisma.client.findFirst({
      where: {
        userID: data.from,
      },
    });
    if (user) {
      const { valid, user } = await verifyStoredUserSignature({
        prismaClient: prisma,
        userId: data.from,
        payload: data.payload,
        signature: data.sig,
      });

      if (!valid) {
        sendError(socket, "INVALID_SIG", "Signature invalid!");
        return;
      }

      if (user) {
        console.log("Signature valid:", user.userID);
      }
    }
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
    console.log("User", data.from, "is now ACTIVE in database");

    send(socket, {
      type: "ACK",
      from: "server",
      to: data.from,
      payload: {
        message: "Welcome to the chat!",
      },
    });

    // Send public channel key to new user (SOCP compliance) - silent
    send(socket, {
      type: "PUBLIC_CHANNEL_KEY_DELIVERY",
      from: "server",
      to: data.from,
      payload: {
        wrapped_key: "placeholder_wrapped_key_for_public_channel",
        channel_id: "public",
        version: 1,
      },
    });
    if (!socket.__userStatusCleanup) {
      socket.__userStatusCleanup = true;
      socket.on("close", async () => {
        const userId =
          connectionRegistry.getUserIdBySocket(socket) || data.from;
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
