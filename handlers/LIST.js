"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");
const defaultRegistry = require("../utilities/connection-registry");
const { connectToIntroducers } = require("../utilities/server-join");
const { subMinutes } = require("date-fns");

const prisma = new PrismaClient();
const FALLBACK_SERVER_ID = process.env.SERVER_ID || "G29_SERVER";

function resolveJoinPayload(fastify) {
  if (!fastify || typeof fastify !== "object") {
    return null;
  }

  const decorated = fastify.serverJoinPayload;
  if (
    decorated &&
    typeof decorated === "object" &&
    typeof decorated.host === "string" &&
    decorated.host.trim() &&
    Number.isInteger(decorated.port) &&
    decorated.port > 0 &&
    typeof decorated.pubkey === "string" &&
    decorated.pubkey.trim()
  ) {
    return decorated;
  }

  const addressInfo =
    typeof fastify.server?.address === "function"
      ? fastify.server.address()
      : null;

  const defaultHost = process.env.SERVER_PUBLIC_HOST || "localhost";
  let host = defaultHost;

  if (typeof addressInfo === "string") {
    try {
      const url = new URL(addressInfo);
      if (
        typeof url.hostname === "string" &&
        url.hostname &&
        !url.hostname.includes("::") &&
        url.hostname !== "0.0.0.0"
      ) {
        host = url.hostname;
      }
    } catch (_error) {
      // Ignore malformed address strings and fall back to defaults.
    }
  } else if (addressInfo && typeof addressInfo === "object") {
    const candidate = addressInfo.address;
    if (
      typeof candidate === "string" &&
      candidate &&
      !candidate.includes("::") &&
      candidate !== "0.0.0.0"
    ) {
      host = candidate;
    }
  }

  const portCandidates = [
    Number.parseInt(process.env.SERVER_PUBLIC_PORT || "", 10),
    typeof addressInfo?.port === "number" ? addressInfo.port : null,
    Number.parseInt(addressInfo?.port, 10),
    Number.parseInt(process.env.PORT || "", 10),
    3000,
  ];

  const port =
    portCandidates.find(
      (value) => Number.isInteger(value) && value > 0 && value <= 65535,
    ) ?? 3000;

  const pubkey = fastify.serverIdentity?.publicKeyBase64Url;
  if (typeof pubkey !== "string" || !pubkey.trim()) {
    return null;
  }

  return {
    host,
    port,
    pubkey,
  };
}

module.exports = async function LIST(props) {
  const {
    socket,
    data,
    meta,
    fastify,
    connectionRegistry = defaultRegistry,
  } = props;
  console.log("[LIST] Request from:", data.from);

  try {
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

    if (fastify) {
      const bootstrapServers = fastify.bootstrapServers || [];
      if (Array.isArray(bootstrapServers) && bootstrapServers.length > 0) {
        const joinPayload = resolveJoinPayload(fastify);
        if (joinPayload) {
          try {
            await connectToIntroducers({
              bootstrapServers,
              joinPayload,
              connectionRegistry,
              logger: fastify.log,
              from: fastify.serverIdentity?.keyId || FALLBACK_SERVER_ID,
              serverIdentity: fastify.serverIdentity,
              fastify,
            });
          } catch (error) {
            fastify.log?.warn?.(
              error,
              "LIST failed to refresh introducer connections",
            );
          }
        } else {
          fastify.log?.debug?.(
            "LIST request skipped introducer refresh due to missing join payload",
          );
        }
      }
    }

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
