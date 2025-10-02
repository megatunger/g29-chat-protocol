"use strict";

const defaultRegistry = require("../utilities/connection-registry");

module.exports = async function SERVER_WELCOME(props) {
  const { data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data || typeof data !== "object") {
    return;
  }

  const payload = data.payload;
  if (!payload || typeof payload !== "object") {
    return;
  }

  const clients = Array.isArray(payload.clients) ? payload.clients : [];
  const serverId = typeof data.from === "string" ? data.from.trim() : null;

  try {
    if (typeof connectionRegistry.upsertExternalUsers === "function") {
      connectionRegistry.upsertExternalUsers(serverId, clients, {
        timestamp: Date.now(),
      });
    }
    fastify?.log?.debug?.(
      {
        serverId,
        clients: clients.length,
      },
      "Stored external users from SERVER_WELCOME",
    );
  } catch (error) {
    fastify?.log?.error?.(error, "Failed to store SERVER_WELCOME clients");
  }
};
