"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");
const defaultRegistry = require("../utilities/connection-registry");
const { subMinutes } = require("date-fns");

const prisma = new PrismaClient();

module.exports = async function LIST(props) {
  const { socket, data, meta, connectionRegistry = defaultRegistry } = props;
  console.log("[LIST] Request from:", data.from);

  try {
    const activeUsers = await prisma.client.findMany({
      where: {
        isActive: true,
        ts: {
          gte: subMinutes(new Date().getTime(), 10),
        },
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

    let externalUsers = [];
    try {
      if (typeof connectionRegistry.listExternalUsers === "function") {
        externalUsers = connectionRegistry.listExternalUsers();
      }
    } catch (error) {
      console.warn("Failed to list external users", error);
    }

    const seenUserIds = new Set(activeUsers.map((user) => user.userID));
    const normalizedExternalUsers = externalUsers
      .filter((user) => user && typeof user.userID === "string")
      .filter((user) => {
        if (seenUserIds.has(user.userID)) {
          return false;
        }
        seenUserIds.add(user.userID);
        return true;
      })
      .map((user) => ({
        userID: user.userID,
        version: user.version || "external",
        ts:
          typeof user.ts === "number"
            ? new Date(user.ts)
            : user.ts || new Date(),
        pubkey: user.pubkey || null,
        host: user.host || null,
        port: user.port || null,
        sourceServer: user.sourceServer || null,
      }));

    const combinedUsers = [...activeUsers, ...normalizedExternalUsers];

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
        users: combinedUsers,
        total: combinedUsers.length,
        message: `Found ${combinedUsers.length} active users online`,
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
