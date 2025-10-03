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

module.exports = async function FILE_END(props) {
  const { socket, data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data || typeof data !== "object") {
    throw new Error("Missing message data");
  }

  if (!data.from || typeof data.from !== "string") {
    throw new Error("Missing userID in 'from' field");
  }

  if (!data.payload || typeof data.payload !== "object") {
    sendError(socket, "INVALID_PAYLOAD", "Missing payload for FILE_END");
    return;
  }

  const { file_id: fileId } = data.payload;

  if (!fileId || typeof fileId !== "string") {
    sendError(socket, "INVALID_FILE_ID", "file_id must be provided");
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
      sendError(socket, "INVALID_SIG", "Signature invalid for FILE_END");
      return;
    }

    const transfer = fileTransferRegistry.endTransfer(fileId);

    if (!transfer) {
      sendError(socket, "UNKNOWN_TRANSFER", "No active transfer for file_id");
      return;
    }

    if (transfer.senderId !== data.from) {
      sendError(socket, "TRANSFER_MISMATCH", "Sender mismatch for file end");
      return;
    }

    const recipientSocket = connectionRegistry.getUserConnection(
      transfer.recipientId,
    );

    if (!isSocketOpen(recipientSocket)) {
      sendError(
        socket,
        "RECIPIENT_UNAVAILABLE",
        `Recipient ${transfer.recipientId} is not connected`,
      );
      return;
    }

    send(recipientSocket, {
      type: "FILE_END",
      from: data.from,
      to: transfer.recipientId,
      payload: {
        file_id: fileId,
        name: transfer.name,
        size: transfer.size,
        sha256: typeof transfer.sha256 === "string" ? transfer.sha256 : "",
        chunks: transfer.receivedChunks,
        mode: typeof transfer.mode === "string" ? transfer.mode : "dm",
      },
    });

    if (fastify?.log) {
      fastify.log.debug(
        {
          fileId,
          sender: data.from,
          recipient: transfer.recipientId,
          chunks: transfer.receivedChunks,
        },
        "Relayed FILE_END to recipient",
      );
    }
  } catch (error) {
    if (fastify?.log) {
      fastify.log.error(error, "Failed to process FILE_END");
    }
    sendError(
      socket,
      "FILE_END_FAILED",
      error?.message || "Failed to finalize file transfer",
    );
  }
};
