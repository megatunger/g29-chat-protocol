"use strict";

const { send, sendServerMessage } = require("../utilities/message-utils");
const defaultRegistry = require("../utilities/connection-registry");
const {
  getLocalRoutingMetadata,
  isSameServer,
} = require("../utilities/server-routing");

const FALLBACK_SERVER_ID = process.env.SERVER_ID || "G29_SERVER";

function isSocketOpen(socket) {
  if (!socket) {
    return false;
  }

  if (typeof socket.readyState !== "number") {
    return true;
  }

  return socket.readyState === 1 || socket.readyState === socket.OPEN;
}

module.exports = async function SERVER_DELIVER(props) {
  const { data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data || typeof data !== "object") {
    fastify?.log?.warn?.("SERVER_DELIVER invoked without data payload");
    return;
  }

  const payload = data.payload;
  if (!payload || typeof payload !== "object") {
    fastify?.log?.warn?.(
      { from: data.from, to: data.to },
      "SERVER_DELIVER missing payload",
    );
    return;
  }

  const recipientId =
    typeof payload.user_id === "string" ? payload.user_id.trim() : "";

  if (!recipientId) {
    fastify?.log?.warn?.(
      { from: data.from, to: data.to },
      "SERVER_DELIVER missing user_id",
    );
    return;
  }

  const ciphertext =
    typeof payload.ciphertext === "string" ? payload.ciphertext : null;
  const senderPub =
    typeof payload.sender_pub === "string" ? payload.sender_pub : null;
  const contentSig =
    typeof payload.content_sig === "string" ? payload.content_sig : null;
  const senderLabel =
    typeof payload.sender === "string" ? payload.sender : null;

  if (!ciphertext || !senderPub || !contentSig) {
    fastify?.log?.warn?.(
      { recipientId, from: data.from },
      "SERVER_DELIVER payload missing cryptographic fields",
    );
    return;
  }

  const localServerId = fastify?.serverIdentity?.keyId || FALLBACK_SERVER_ID;
  const { joinPayload: localJoinPayload, identifier: localAddressId } =
    getLocalRoutingMetadata(fastify);

  const recipientSocket =
    typeof connectionRegistry.getUserConnection === "function"
      ? connectionRegistry.getUserConnection(recipientId)
      : null;

  if (recipientSocket && isSocketOpen(recipientSocket)) {
    try {
      send(recipientSocket, {
        type: "USER_DELIVER",
        from: "server",
        to: recipientId,
        payload: {
          sender: senderLabel || data.from || "remote",
          sender_pub: senderPub,
          ciphertext,
          content_sig: contentSig,
        },
      });
      fastify?.log?.debug?.(
        { recipientId, from: data.from },
        "SERVER_DELIVER delivered to local user",
      );
      return;
    } catch (error) {
      fastify?.log?.error?.(error, "SERVER_DELIVER local delivery failed");
    }
  }

  let targetServerId =
    typeof payload.server_id === "string" && payload.server_id.trim()
      ? payload.server_id.trim()
      : null;
  if (typeof connectionRegistry.listExternalUsers === "function") {
    try {
      const externalUsers = connectionRegistry.listExternalUsers();
      if (Array.isArray(externalUsers)) {
        const match = externalUsers.find(
          (entry) =>
            entry &&
            typeof entry.userID === "string" &&
            entry.userID.trim() === recipientId &&
            typeof entry.sourceServer === "string" &&
            entry.sourceServer.trim(),
        );
        if (match) {
          targetServerId = match.sourceServer.trim();
        }
      }
    } catch (error) {
      fastify?.log?.warn?.(error, "SERVER_DELIVER failed to list external users");
    }
  }

  if (!targetServerId) {
    fastify?.log?.info?.(
      { recipientId, from: data.from },
      "SERVER_DELIVER recipient location unknown",
    );
    return;
  }

  if (targetServerId === data.from) {
    fastify?.log?.debug?.(
      { recipientId, targetServerId },
      "SERVER_DELIVER already sourced from target server, skipping forward",
    );
    return;
  }

  const targetSocket =
    typeof connectionRegistry.getServerConnection === "function"
      ? connectionRegistry.getServerConnection(targetServerId)
      : null;

  if (
    isSameServer({
      serverId: targetServerId,
      localServerId,
      localJoinPayload,
      localIdentifier: localAddressId,
      socket: targetSocket,
    })
  ) {
    fastify?.log?.debug?.(
      { recipientId, targetServerId },
      "SERVER_DELIVER target matches local server, skipping",
    );
    return;
  }

  if (!isSocketOpen(targetSocket)) {
    fastify?.log?.warn?.(
      { recipientId, targetServerId },
      "SERVER_DELIVER target server connection unavailable",
    );
    return;
  }

  try {
    sendServerMessage({
      socket: targetSocket,
      serverIdentity: fastify?.serverIdentity,
      message: {
        type: "SERVER_DELIVER",
        from: localServerId,
        to: targetServerId,
        payload: {
          user_id: recipientId,
          sender: senderLabel || data.from || "remote",
          sender_pub: senderPub,
          ciphertext,
          content_sig: contentSig,
        },
      },
    });
    fastify?.log?.debug?.(
      { recipientId, targetServerId },
      "SERVER_DELIVER forwarded to remote server",
    );
  } catch (error) {
    fastify?.log?.error?.(
      error,
      "SERVER_DELIVER forwarding to remote server failed",
    );
  }
};
