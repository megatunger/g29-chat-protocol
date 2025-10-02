"use strict";

const defaultRegistry = require("../utilities/connection-registry");
const { send, sendError } = require("../utilities/message-utils");
const { connectToIntroducers } = require("../utilities/server-join");
const { PrismaClient } = require("../generated/prisma");

const FALLBACK_SERVER_ID = process.env.SERVER_ID || "G29_SERVER";
let lastConnectionReport = null;
const prisma = new PrismaClient();

function normalizePort(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("SERVER_HELLO_JOIN requires a payload object");
  }

  const host = typeof payload.host === "string" ? payload.host.trim() : "";
  if (!host) {
    throw new Error("SERVER_HELLO_JOIN payload.host must be a non-empty string");
  }

  const port = normalizePort(payload.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      "SERVER_HELLO_JOIN payload.port must be an integer between 1 and 65535",
    );
  }

  const pubkey =
    typeof payload.pubkey === "string" ? payload.pubkey.trim() : undefined;
  if (!pubkey) {
    throw new Error("SERVER_HELLO_JOIN payload.pubkey must be a non-empty string");
  }

  return { host, port, pubkey };
}

module.exports = async function SERVER_HELLO_JOIN(props) {
  const {
    socket,
    data,
    fastify,
    connectionRegistry = defaultRegistry,
  } = props;

  if (!fastify) {
    throw new Error("SERVER_HELLO_JOIN handler requires fastify instance");
  }

  let joinPayload;
  try {
    joinPayload = validatePayload(data?.payload);
  } catch (error) {
    sendError(socket, "INVALID_PAYLOAD", error.message);
    return;
  }

  const bootstrapServers = fastify.bootstrapServers || [];
  if (!Array.isArray(bootstrapServers) || bootstrapServers.length === 0) {
    sendError(socket, "NO_BOOTSTRAP", "No bootstrap servers configured");
    return;
  }

  try {
    const result = await connectToIntroducers({
      bootstrapServers,
      joinPayload,
      connectionRegistry,
      logger: fastify.log,
      from:
        data?.from || fastify.serverIdentity?.keyId || process.env.SERVER_ID || FALLBACK_SERVER_ID,
    });

    const localServerId =
      fastify.serverIdentity?.keyId || process.env.SERVER_ID || FALLBACK_SERVER_ID;

    const connectedServers = result.successes.map((entry) => entry.identifier);
    const failedServers = result.failures.map((entry) => ({
      identifier: entry.identifier,
      error: entry.error?.message || "Unknown error",
    }));
    const skippedServers = result.skipped.map((entry) => entry.identifier);
    const activeServers =
      typeof connectionRegistry.listActiveServers === "function"
        ? connectionRegistry.listActiveServers()
        : [];

    const connectionReport = {
      attempted: bootstrapServers.length,
      connected: connectedServers,
      failed: failedServers,
      skipped: skippedServers,
      activeServers,
      requester: data?.from || null,
    };

    const serializedReport = JSON.stringify(connectionReport);
    if (serializedReport !== lastConnectionReport) {
      fastify.log.info(
        connectionReport,
        "SERVER_HELLO_JOIN connection results",
      );
      lastConnectionReport = serializedReport;
    } else {
      fastify.log.debug(
        { requester: connectionReport.requester },
        "SERVER_HELLO_JOIN connection results unchanged",
      );
    }

    let activeUsers = [];
    try {
      activeUsers = await prisma.client.findMany({
        where: { isActive: true },
        select: { userID: true, pubkey: true },
        orderBy: { ts: "desc" },
      });
    } catch (error) {
      fastify.log.error(error, "Failed to load active users for SERVER_WELCOME");
    }

    const { host: serverHost, port: serverPort } = resolveServerAddress(fastify);
    const clients = activeUsers.map((user) => ({
      user_id: user.userID,
      host: serverHost,
      port: serverPort,
      pubkey: user.pubkey,
    }));

    const assignedId =
      data?.payload?.requestedId ||
      data?.from ||
      `${joinPayload.host}:${joinPayload.port}`;

    send(socket, {
      type: "SERVER_WELCOME",
      from: localServerId,
      to: data?.from || localServerId,
      payload: {
        assigned_id: assignedId,
        clients,
      },
      sig: "",
    });
  } catch (error) {
    fastify.log.error(error, "SERVER_HELLO_JOIN failed");
    sendError(socket, "INTERNAL_ERROR", error.message);
  }
};
function resolveServerAddress(fastify) {
  const addressInfo =
    typeof fastify?.server?.address === "function"
      ? fastify.server.address()
      : null;

  const defaultHost = process.env.SERVER_PUBLIC_HOST || "localhost";
  const defaultPortCandidates = [
    Number.parseInt(process.env.SERVER_PUBLIC_PORT || "", 10),
    Number.parseInt(process.env.PORT || "", 10),
    3000,
  ];

  const pickPort = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
      ? parsed
      : undefined;
  };

  let host = defaultHost;
  let port = defaultPortCandidates.find((candidate) => pickPort(candidate)) || 3000;
  port = pickPort(port) || 3000;

  if (typeof addressInfo === "string") {
    try {
      const url = new URL(addressInfo);
      const candidateHost = url.hostname;
      const candidatePort = pickPort(url.port);
      if (
        candidateHost &&
        !candidateHost.includes("::") &&
        candidateHost !== "0.0.0.0"
      ) {
        host = candidateHost;
      }
      if (candidatePort) {
        port = candidatePort;
      }
    } catch (_error) {
      // Ignore malformed address strings and fall back to defaults.
    }
  } else if (addressInfo && typeof addressInfo === "object") {
    const candidateHost = addressInfo.address;
    const candidatePort = pickPort(addressInfo.port);
    if (
      typeof candidateHost === "string" &&
      candidateHost &&
      !candidateHost.includes("::") &&
      candidateHost !== "0.0.0.0"
    ) {
      host = candidateHost;
    }
    if (candidatePort) {
      port = candidatePort;
    }
  }

  return { host, port };
}
