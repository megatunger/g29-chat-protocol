"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const connectionRegistry = require("../utilities/connection-registry");

const prisma = new PrismaClient();

const PUBLIC_CHANNEL_KEY = "shared_public_channel_key_placeholder";

module.exports = async function PUBLIC_CHANNEL_KEY_SHARE(props) {
  const { socket, data, meta } = props;
  console.log("[PUBLIC_CHANNEL_KEY_SHARE] Distributing public channel key");

  try {

    const activeUsers = await prisma.client.findMany({
      where: { isActive: true },
      select: { userID: true, pubkey: true },
    });

    const connections = connectionRegistry.getAllConnections();
    
    for (const [userID, userSocket] of connections) {
      if (userSocket.readyState === 1) {
        send(userSocket, {
          type: "PUBLIC_CHANNEL_KEY_DELIVERY",
          from: "server",
          to: userID,
          payload: {
            channel_id: "public", // Use channel_id to match frontend expectations
            wrapped_key: PUBLIC_CHANNEL_KEY, 
            version: 1,
          },
        });
      }
    }
    send(socket, {
      type: "PUBLIC_CHANNEL_KEY_SHARE_ACK",
      from: "server", 
      to: data.from,
      payload: {
        status: "distributed",
        recipients: connections.size,
      },
    });

  } catch (error) {
    console.error("Public channel key share error:", error);
    send(socket, {
      type: "ERROR",
      from: "server",
      to: data.from,
      payload: {
        code: "KEY_DISTRIBUTION_FAILED",
        detail: "Failed to distribute public channel keys",
      },
    });
  }
};