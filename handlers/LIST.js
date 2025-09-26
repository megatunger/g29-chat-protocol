"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");

const prisma = new PrismaClient();

module.exports = async function LIST(props) {
  const { socket, data, meta } = props;
  console.log("[LIST] Request from:", data.from);

  try {
    const activeUsers = await prisma.client.findMany({
      where: {
        isActive: true,
      },
      select: {
        userID: true,
        version: true,
        ts: true,
        pubkey: true,
      },
      orderBy: {
        ts: "desc",
      },
    });

    console.log(`Found ${activeUsers.length} ACTIVE users`);

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
      console.log("✅ Signature valid: ", user.userID);
    }
    send(socket, {
      type: "USER_LIST",
      from: "server",
      to: data.from,
      payload: {
        users: activeUsers,
        total: activeUsers.length,
        message: `Found ${activeUsers.length} active users online`,
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    send(socket, {
      type: "ERROR",
      from: "server",
      to: data.from,
      payload: {
        code: "DATABASE_ERROR",
        detail: "Failed to retrieve users from database",
      },
    });
  }
};
