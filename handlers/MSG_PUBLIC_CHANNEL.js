"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const connectionRegistry = require("../utilities/connection-registry");

const prisma = new PrismaClient();

module.exports = async function MSG_PUBLIC_CHANNEL(props) {
  const { socket, data, meta } = props;
  console.log("[MSG_PUBLIC_CHANNEL] Request:", data);

  // SOCP compliance: Only accept encrypted messages with proper signature
  if (!data.payload || !data.payload.ciphertext) {
    throw new Error("Missing ciphertext in payload - plaintext not allowed per SOCP v1.3");
  }

  if (!data.payload.content_sig) {
    throw new Error("Missing content signature - required per SOCP v1.3");
  }

  if (!data.payload.sender_pub) {
    throw new Error("Missing sender public key - required per SOCP v1.3");
  }

  try {
    // Get all active users to broadcast to
    const activeUsers = await prisma.client.findMany({
      where: {
        isActive: true,
      },
      select: {
        userID: true,
        pubkey: true,
      },
    });

    console.log("Broadcasting public message from", data.from, "to", activeUsers.length, "users");

    // Get all active WebSocket connections
    const connections = connectionRegistry.getAllConnections();
    console.log("Connection registry has", connections.size, "connections:", Array.from(connections.keys()));
    console.log("Database shows", activeUsers.length, "active users:", activeUsers.map(u => u.userID));
    
    // Clean up stale database records - mark users as inactive if not connected
    for (const user of activeUsers) {
      if (!connections.has(user.userID)) {
        console.log("Marking", user.userID, "as inactive (not connected)");
        await prisma.client.update({
          where: { userID: user.userID },
          data: { isActive: false },
        });
      }
    }
    
    let deliveredCount = 0;

    // Send the public message to all connected users (except sender)
    for (const [userID, userSocket] of connections) {
      if (userID !== data.from && userSocket.readyState === 1) {
        try {
          send(userSocket, {
            type: "MSG_PUBLIC_CHANNEL_DELIVERY",
            from: "server",
            to: userID,
            payload: {
              sender: data.from,
              sender_pub: data.payload.sender_pub,
              ciphertext: data.payload.ciphertext,
              content_sig: data.payload.content_sig,
              timestamp: data.payload.timestamp,
            },
          });
          deliveredCount++;
        } catch (error) {
          console.error("Failed to deliver to", userID, ":", error);
        }
      }
    }

    // Send confirmation back to sender
    send(socket, {
      type: "MSG_PUBLIC_CHANNEL_ACK",
      from: "server",
      to: data.from,
      payload: {
        status: "broadcast",
        recipients: deliveredCount,
        message: "Message broadcast to " + deliveredCount + " users",
      },
    });

    console.log("Public message from", data.from, "delivered to", deliveredCount, "users");

  } catch (error) {
    console.error("Public channel message error:", error);
    send(socket, {
      type: "ERROR",
      from: "server",
      to: data.from,
      payload: {
        code: "BROADCAST_FAILED",
        detail: "Failed to broadcast message to public channel",
      },
    });
  }
};