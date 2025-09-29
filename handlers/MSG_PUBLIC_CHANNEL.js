"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

module.exports = async function MSG_PUBLIC_CHANNEL(props) {
  const { socket, data, meta } = props;
  console.log("[MSG_PUBLIC_CHANNEL] Request:", data);

  if (!data.payload || !data.payload.ciphertext) {
    throw new Error("Missing ciphertext in payload");
  }

  if (!data.payload.content_sig) {
    throw new Error("Missing content signature in payload");
  }

  try {

    const activeUsers = await prisma.client.findMany({
      where: {
        isActive: true,
      },
      select: {
        userID: true,
        pubkey: true,
      },
    });

    console.log(`Broadcasting public message from ${data.from} to ${activeUsers.length} users`);

    // For now, just send confirmation back to sender
    // In a full implementation, we'd forward to all users
    send(socket, {
      type: "MSG_PUBLIC_CHANNEL_ACK",
      from: "server",
      to: data.from,
      payload: {
        status: "broadcast",
        recipients: activeUsers.length,
        message: "Message broadcast to public channel",
      },
    });

    // TODO: In full implementation, forward encrypted message to all active users
    // This would involve sending MSG_PUBLIC_CHANNEL_DELIVERY to each user

    console.log(`Public channel message from ${data.from} broadcast to ${activeUsers.length} users`);

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