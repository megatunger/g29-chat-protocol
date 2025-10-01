"use strict";

const defaultRegistry = require("../utilities/connection-registry");
const { send, sendError } = require("../utilities/message-utils");
const {
  connectToIntroducers,
  makeServerIdentifier,
} = require("../utilities/server-join");

const FALLBACK_SERVER_ID = process.env.SERVER_ID || "G29_SERVER";
let lastConnectionReport = null;

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

  const remoteIdentifier = makeServerIdentifier(
    joinPayload.host,
    joinPayload.port,
  );

  try {
    connectionRegistry.registerServerConnection(remoteIdentifier, socket);
    fastify.log.info(
      { identifier: remoteIdentifier, requester: data?.from || null },
      "Registered inbound server connection",
    );
  } catch (error) {
    fastify.log.warn(
      error,
      `Failed to register inbound server connection for ${remoteIdentifier}`,
    );
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
      joiningServer: {
        host: joinPayload.host,
        port: joinPayload.port,
      },
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

    send(socket, {
      type: "SERVER_WELCOME",
      from: localServerId,
      to: data?.from || localServerId,
      payload: {
        assignment: {
          id:
            data?.payload?.requestedId ||
            data?.from ||
            `${joinPayload.host}:${joinPayload.port}`,
        },
        servers: {
          attempted: bootstrapServers.length,
          connected: connectedServers,
          failed: failedServers,
          skipped: skippedServers,
        },
      },
    });
  } catch (error) {
    fastify.log.error(error, "SERVER_HELLO_JOIN failed");
    sendError(socket, "INTERNAL_ERROR", error.message);
  }
};
