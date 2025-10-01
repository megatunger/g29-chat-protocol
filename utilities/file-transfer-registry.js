"use strict";

const transfers = new Map();

function validateTransferInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Transfer details must be an object");
  }

  const {
    transferId,
    senderId,
    recipientId,
    fileName,
    fileSize,
    totalChunks,
    chunkSize = null,
    mimeType = null,
    encryption = {},
    metadata = {},
  } = input;

  if (!transferId || typeof transferId !== "string" || !transferId.trim()) {
    throw new Error("transferId must be a non-empty string");
  }
  if (!senderId || typeof senderId !== "string" || !senderId.trim()) {
    throw new Error("senderId must be a non-empty string");
  }
  if (!recipientId || typeof recipientId !== "string" || !recipientId.trim()) {
    throw new Error("recipientId must be a non-empty string");
  }
  if (!fileName || typeof fileName !== "string" || !fileName.trim()) {
    throw new Error("fileName must be a non-empty string");
  }
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

  if (encryption !== null && typeof encryption !== "object") {
    throw new Error("encryption must be an object when provided");
  }

  if (metadata !== null && typeof metadata !== "object") {
    throw new Error("metadata must be an object when provided");
  }

  return {
    transferId: transferId.trim(),
    senderId: senderId.trim(),
    recipientId: recipientId.trim(),
    fileName: fileName.trim(),
    fileSize,
    totalChunks,
    chunkSize,
    mimeType: typeof mimeType === "string" && mimeType.trim() ? mimeType.trim() : null,
    encryption: encryption ? { ...encryption } : {},
    metadata: metadata ? { ...metadata } : {},
  };
}

function createTransfer(details) {
  const normalized = validateTransferInput(details);

  if (transfers.has(normalized.transferId)) {
    throw new Error(`Transfer with id ${normalized.transferId} already exists`);
  }

  const record = {
    ...normalized,
    status: "initiated",
    chunksReceived: 0,
    bytesReceived: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  transfers.set(record.transferId, record);
  return record;
}

function getTransfer(transferId) {
  if (!transferId || typeof transferId !== "string") {
    return null;
  }
  return transfers.get(transferId) || null;
}

function updateTransfer(transferId, updates) {
  if (!transfers.has(transferId)) {
    throw new Error(`Transfer with id ${transferId} does not exist`);
  }

  const current = transfers.get(transferId);
  const next = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };

  transfers.set(transferId, next);
  return next;
}

function removeTransfer(transferId) {
  return transfers.delete(transferId);
}

function listTransfersForUser(userId) {
  if (!userId || typeof userId !== "string") {
    return [];
  }

  return Array.from(transfers.values()).filter(
    (transfer) => transfer.senderId === userId || transfer.recipientId === userId,
  );
}

function clearAllTransfers() {
  transfers.clear();
}

module.exports = {
  createTransfer,
  getTransfer,
  updateTransfer,
  removeTransfer,
  listTransfersForUser,
  clearAllTransfers,
};
