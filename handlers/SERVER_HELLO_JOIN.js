"use strict";

const defaultRegistry = require("../utilities/connection-registry");
const { send, sendError } = require("../utilities/message-utils");
const { connectToIntroducers } = require("../utilities/server-join");

const DEFAULT_SERVER_ID = process.env.SERVER_ID || "G29_SERVER";

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
      from: data?.from || DEFAULT_SERVER_ID,
    });

    send(socket, {
      type: "SERVER_HELLO_JOIN_RESULT",
      from: DEFAULT_SERVER_ID,
      to: data?.from || DEFAULT_SERVER_ID,
      payload: {
        attempted: bootstrapServers.length,
        connected: result.successes.map((entry) => entry.identifier),
        failed: result.failures.map((entry) => ({
          identifier: entry.identifier,
          error: entry.error?.message || "Unknown error",
        })),
        skipped: result.skipped.map((entry) => entry.identifier),
      },
    });
  } catch (error) {
    fastify.log.error(error, "SERVER_HELLO_JOIN failed");
    sendError(socket, "INTERNAL_ERROR", error.message);
  }
};
