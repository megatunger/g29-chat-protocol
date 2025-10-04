"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");
const defaultRegistry = require("../utilities/connection-registry");
const {
  connectToIntroducers,
  resolveServerJoinPayload,
} = require("../utilities/server-join");
const { subMinutes } = require("date-fns");

const prisma = new PrismaClient();
const FALLBACK_SERVER_ID = process.env.SERVER_ID || "G29_SERVER";

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
        const joinPayload = resolveServerJoinPayload({ fastify });
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

    // fetch all clients from DB (include isActive + ts)
    const dbUsers = await prisma.client.findMany({
      select: {
        userID: true,
        version: true,
        ts: true,
        pubkey: true,
        isActive: true,
      },
      orderBy: {
        ts: "desc",
      },
    });

    // list external users (from in-memory registry)
    let externalUsers = [];
    try {
      if (typeof connectionRegistry.listExternalUsers === "function") {
        externalUsers = connectionRegistry.listExternalUsers() || [];
      }
    } catch (error) {
      console.warn("Failed to list external users", error);
    }

    // build a combined deduped list: prefer DB record when available
    const seen = new Set();
    const cutoff = subMinutes(new Date(), 10);
    const combined = [];

    // add DB users first
    for (const u of dbUsers) {
      const uid = u.userID;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      const tsDate = u.ts instanceof Date ? u.ts : new Date(u.ts || Date.now());
      const isOnline = Boolean(u.isActive) && tsDate >= cutoff;
      combined.push({
        userID: uid,
        version: u.version || "db",
        ts: tsDate,
        pubkey: u.pubkey || null,
        isActive: Boolean(u.isActive),
        isOnline,
        source: "db",
      });
    }

    // add external users that were not in DB
    for (const eu of externalUsers) {
      if (!eu || typeof eu.userID !== "string") continue;
      if (seen.has(eu.userID)) continue;
      seen.add(eu.userID);
      const tsDate =
        typeof eu.ts === "number" ? new Date(eu.ts) : eu.ts ? new Date(eu.ts) : new Date();
      const isActiveFlag = typeof eu.isActive === "boolean" ? eu.isActive : true;
      const isOnline = Boolean(isActiveFlag) && tsDate >= cutoff;
      combined.push({
        userID: eu.userID,
        version: eu.version || "external",
        ts: tsDate,
        pubkey: eu.pubkey || null,
        host: eu.host || null,
        port: eu.port || null,
        sourceServer: eu.sourceServer || null,
        isActive: isActiveFlag,
        isOnline,
        source: "external",
      });
    }

    // totals
    const total = combined.length;
    const totalOnline = combined.filter((x) => x.isOnline).length;
    const totalDisabled = combined.filter((x) => !x.isActive).length;

    console.log(`Found ${totalOnline} online, ${totalDisabled} disabled, total ${total}`);

    // prepare serializable users (ensure ts is string and booleans are explicit)
    const serializableUsers = combined.map((u) => ({
      userID: u.userID,
      version: u.version,
      ts: u.ts instanceof Date ? u.ts.toISOString() : new Date(u.ts).toISOString(),
      pubkey: u.pubkey || null,
      host: u.host || null,
      port: u.port || null,
      sourceServer: u.sourceServer || null,
      isActive: Boolean(u.isActive),
      isOnline: Boolean(u.isOnline),
      source: u.source || null,
    }));

    // send a single users array with flags: isActive and isOnline
    send(socket, {
      type: "USER_LIST",
      from: "server",
      to: data.from,
      payload: {
        users: serializableUsers,
        total,
        totalOnline,
        totalDisabled,
        message: `Found ${totalOnline} active users and ${totalDisabled} disabled users (total ${total})`,
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
        detail: "Failed to retrieve users from database: " + (error && error.message),
      },
    });
  }
};