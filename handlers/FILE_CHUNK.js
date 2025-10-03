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

module.exports = async function FILE_CHUNK(props) {
  const { socket, data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data || typeof data !== "object") {
    throw new Error("Missing message data");
  }

  if (!data.from || typeof data.from !== "string") {
    throw new Error("Missing userID in 'from' field");
  }

  if (!data.payload || typeof data.payload !== "object") {
    sendError(socket, "INVALID_PAYLOAD", "Missing payload for FILE_CHUNK");
    return;
  }

  const { file_id: fileId, index, ciphertext } = data.payload;

  if (!fileId || typeof fileId !== "string") {
    sendError(socket, "INVALID_FILE_ID", "file_id must be provided");
    return;
  }

  if (typeof index !== "number" || index < 0) {
    sendError(
      socket,
      "INVALID_CHUNK_INDEX",
      "Chunk index must be a non-negative number",
    );
    return;
  }

  if (typeof ciphertext !== "string" || !ciphertext) {
    sendError(
      socket,
      "INVALID_CIPHERTEXT",
      "Chunk ciphertext must be provided",
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
      sendError(socket, "INVALID_SIG", "Signature invalid for FILE_CHUNK");
      return;
    }

    const transfer = fileTransferRegistry.getTransfer(fileId);

    if (!transfer) {
      sendError(socket, "UNKNOWN_TRANSFER", "No active transfer for file_id");
      return;
    }

    if (transfer.senderId !== data.from) {
      sendError(socket, "TRANSFER_MISMATCH", "Sender mismatch for file chunk");
      return;
    }

    const recipientSocket = connectionRegistry.getUserConnection(
      transfer.recipientId,
    );

    if (!isSocketOpen(recipientSocket)) {
      fileTransferRegistry.abandonTransfer(fileId);
      sendError(
        socket,
        "RECIPIENT_UNAVAILABLE",
        `Recipient ${transfer.recipientId} is not connected`,
      );
      return;
    }

    try {
      fileTransferRegistry.recordChunk({
        fileId,
        index,
        chunkLength: Math.ceil((ciphertext.length * 3) / 4),
      });
    } catch (error) {
      if (fastify?.log) {
        fastify.log.warn(error, "Failed to record FILE_CHUNK metadata");
      }
    }

    send(recipientSocket, {
      type: "FILE_CHUNK",
      from: data.from,
      to: transfer.recipientId,
      payload: {
        file_id: fileId,
        index,
        ciphertext,
      },
    });
  } catch (error) {
    if (fastify?.log) {
      fastify.log.error(error, "Failed to process FILE_CHUNK");
    }
    sendError(
      socket,
      "FILE_CHUNK_FAILED",
      error?.message || "Failed to relay file chunk",
    );
  }
};
