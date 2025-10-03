"use strict";

const activeTransfers = new Map();

function normalizeFileId(fileId) {
  return typeof fileId === "string" && fileId.trim() ? fileId.trim() : null;
}

function startTransfer({
  fileId,
  senderId,
  recipientId,
  name,
  size,
  sha256,
  mode,
  startedAt = Date.now(),
}) {
  const normalizedFileId = normalizeFileId(fileId);
  if (!normalizedFileId) {
    throw new Error("startTransfer requires a non-empty fileId");
  }
  if (activeTransfers.has(normalizedFileId)) {
    throw new Error(`File transfer already active for ${normalizedFileId}`);
  }

  const record = {
    fileId: normalizedFileId,
    senderId,
    recipientId,
    name,
    size,
    sha256,
    mode,
    startedAt,
    nextChunkIndex: 0,
    receivedChunks: 0,
    receivedBytes: 0,
    updatedAt: startedAt,
  };

  activeTransfers.set(normalizedFileId, record);
  return record;
}

function getTransfer(fileId) {
  const normalizedFileId = normalizeFileId(fileId);
  if (!normalizedFileId) {
    return null;
  }
  return activeTransfers.get(normalizedFileId) || null;
}

function recordChunk({ fileId, index, chunkLength }) {
  const transfer = getTransfer(fileId);
  if (!transfer) {
    return null;
  }

  if (typeof index === "number" && index >= 0) {
    transfer.nextChunkIndex = Math.max(transfer.nextChunkIndex, index + 1);
  }

  if (typeof chunkLength === "number" && chunkLength >= 0) {
    transfer.receivedBytes += chunkLength;
  }

  transfer.receivedChunks += 1;
  transfer.updatedAt = Date.now();

  return transfer;
}

function endTransfer(fileId) {
  const transfer = getTransfer(fileId);
  if (!transfer) {
    return null;
  }
  activeTransfers.delete(transfer.fileId);
  return transfer;
}

function abandonTransfer(fileId) {
  const normalizedFileId = normalizeFileId(fileId);
  if (!normalizedFileId) {
    return false;
  }
  return activeTransfers.delete(normalizedFileId);
}

module.exports = {
  startTransfer,
  getTransfer,
  recordChunk,
  endTransfer,
  abandonTransfer,
};
