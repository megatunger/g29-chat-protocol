"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");
const defaultRegistry = require("../utilities/connection-registry");
const fileTransferRegistry = require("../utilities/file-transfer-registry");

const prisma = new PrismaClient();

function ensureString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("FILE_START payload must be an object");
  }

  const {
    transferId,
    recipientId,
    fileName,
    fileSize,
    totalChunks,
    chunkSize = null,
    mimeType = null,
    encryption = {},
    metadata = {},
  } = payload;

  const normalized = {
    transferId: ensureString(transferId, "transferId"),
    recipientId: ensureString(recipientId, "recipientId"),
    fileName: ensureString(fileName, "fileName"),
    fileSize,
    totalChunks,
    chunkSize,
    mimeType,
    encryption,
    metadata,
  };

  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("fileSize must be a positive number");
  }

  if (
    typeof totalChunks !== "number" ||
    !Number.isFinite(totalChunks) ||
    totalChunks <= 0 ||
    !Number.isInteger(totalChunks)
  ) {
    throw new Error("totalChunks must be a positive integer");
  }

  if (
    chunkSize !== null &&
    (typeof chunkSize !== "number" || !Number.isFinite(chunkSize) || chunkSize <= 0)
  ) {
    throw new Error("chunkSize must be a positive number when provided");
  }

  if (mimeType !== null && (typeof mimeType !== "string" || !mimeType.trim())) {
    throw new Error("mimeType must be a non-empty string when provided");
  }

  if (encryption !== null && typeof encryption !== "object") {
    throw new Error("encryption must be an object when provided");
  }

  if (metadata !== null && typeof metadata !== "object") {
    throw new Error("metadata must be an object when provided");
  }

  return {
    ...normalized,
    mimeType: mimeType ? mimeType.trim() : null,
    encryption: encryption ? { ...encryption } : {},
    metadata: metadata ? { ...metadata } : {},
  };
}

module.exports = async function FILE_START(props) {
  const { socket, data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data) {
    throw new Error("Missing message data");
  }

  if (!data.from || typeof data.from !== "string") {
    throw new Error("Missing userID in 'from' field");
  }

  let payload;
  try {
    payload = validatePayload(data.payload);
  } catch (error) {
    sendError(socket, "INVALID_FILE_START", error.message);
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
      sendError(socket, "INVALID_SIG", "Signature invalid");
      return;
    }
  } catch (error) {
    if (fastify?.log) {
      fastify.log.error(error, "Failed to verify FILE_START signature");
    }
    sendError(socket, "INTERNAL_ERROR", "Failed to verify signature");
    return;
  }

  try {
    fileTransferRegistry.createTransfer({
      transferId: payload.transferId,
      senderId: data.from,
      recipientId: payload.recipientId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      totalChunks: payload.totalChunks,
      chunkSize: payload.chunkSize,
      mimeType: payload.mimeType,
      encryption: payload.encryption,
      metadata: payload.metadata,
    });
  } catch (error) {
    sendError(socket, "FILE_TRANSFER_CONFLICT", error.message);
    return;
  }

  const ackTimestamp = new Date().toISOString();

  send(socket, {
    type: "FILE_START_ACK",
    from: "server",
    to: data.from,
    payload: {
      transferId: payload.transferId,
      recipientId: payload.recipientId,
      status: "initiated",
      acknowledgedAt: ackTimestamp,
    },
  });

  const recipientSocket = connectionRegistry.getUserConnection(payload.recipientId);
  const offerPayload = {
    transferId: payload.transferId,
    senderId: data.from,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    totalChunks: payload.totalChunks,
    chunkSize: payload.chunkSize,
    mimeType: payload.mimeType,
    encryption: payload.encryption,
    metadata: payload.metadata,
    offeredAt: ackTimestamp,
  };

  if (recipientSocket) {
    try {
      send(recipientSocket, {
        type: "FILE_OFFER",
        from: "server",
        to: payload.recipientId,
        payload: offerPayload,
      });
    } catch (error) {
      if (fastify?.log) {
        fastify.log.error(error, "Failed to notify recipient about FILE_START");
      }
    }
  }

  if (fastify?.log) {
    fastify.log.info(
      {
        transferId: payload.transferId,
        senderId: data.from,
        recipientId: payload.recipientId,
      },
      "FILE_START processed",
    );
  }
};
