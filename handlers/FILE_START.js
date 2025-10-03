"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");
const defaultRegistry = require("../utilities/connection-registry");
const fileTransferRegistry = require("../utilities/file-transfer-registry");

const prisma = new PrismaClient();

function isSocketOpen(socket) {
  return (
    socket &&
    (typeof socket.readyState !== "number" ||
      socket.readyState === 1 ||
      socket.readyState === socket.OPEN)
  );
}

module.exports = async function FILE_START(props) {
  const { socket, data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data || typeof data !== "object") {
    throw new Error("Missing message data");
  }

  if (!data.from || typeof data.from !== "string") {
    throw new Error("Missing userID in 'from' field");
  }

  if (!data.payload || typeof data.payload !== "object") {
    sendError(socket, "INVALID_PAYLOAD", "Missing payload for FILE_START");
    return;
  }

  const recipientId =
    typeof data.to === "string" && data.to.trim() ? data.to.trim() : null;

  if (!recipientId) {
    sendError(socket, "INVALID_RECIPIENT", "FILE_START requires a recipient");
    return;
  }

  const { file_id: fileId, name, size, sha256, mode } = data.payload;

  if (!fileId || typeof fileId !== "string") {
    sendError(socket, "INVALID_FILE_ID", "file_id must be provided");
    return;
  }

  if (!name || typeof name !== "string") {
    sendError(socket, "INVALID_FILE_NAME", "File name is required");
    return;
  }

  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    sendError(
      socket,
      "INVALID_FILE_SIZE",
      "File size must be a positive number",
    );
    return;
  }

  try {
    const { valid } = await verifyStoredUserSignature({
      prismaClient: prisma,
      userId: data.from,
      payload: data.payload,
      signature: data.sig,
    });

    if (!valid) {
      sendError(socket, "INVALID_SIG", "Signature invalid for FILE_START");
      return;
    }

    const recipientSocket = connectionRegistry.getUserConnection(recipientId);

    if (!isSocketOpen(recipientSocket)) {
      sendError(
        socket,
        "RECIPIENT_UNAVAILABLE",
        `Recipient ${recipientId} is not connected`,
      );
      return;
    }

    try {
      fileTransferRegistry.startTransfer({
        fileId,
        senderId: data.from,
        recipientId,
        name,
        size,
        sha256,
        mode,
      });
    } catch (error) {
      sendError(socket, "TRANSFER_EXISTS", error.message);
      return;
    }

    send(recipientSocket, {
      type: "FILE_START",
      from: data.from,
      to: recipientId,
      payload: {
        file_id: fileId,
        name,
        size,
        sha256: typeof sha256 === "string" ? sha256 : "",
        mode: typeof mode === "string" ? mode : "dm",
      },
    });

    if (fastify?.log) {
      fastify.log.debug(
        {
          fileId,
          sender: data.from,
          recipient: recipientId,
          size,
        },
        "Relayed FILE_START to recipient",
      );
    }
  } catch (error) {
    if (fastify?.log) {
      fastify.log.error(error, "Failed to process FILE_START");
    }
    sendError(
      socket,
      "FILE_START_FAILED",
      error?.message || "Failed to start file transfer",
    );
  }
};
