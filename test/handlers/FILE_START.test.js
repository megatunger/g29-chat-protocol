"use strict";

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const FILE_START = require("../../handlers/FILE_START");
const fileTransferRegistry = require("../../utilities/file-transfer-registry");

function createMockSocket(store) {
  return {
    send(payload) {
      if (typeof payload === "string") {
        store.push(JSON.parse(payload));
        return;
      }
      store.push(JSON.parse(JSON.stringify(payload)));
    },
  };
}

beforeEach(() => {
  fileTransferRegistry.clearAllTransfers();
});

test("FILE_START registers transfer and notifies recipient", async () => {
  const senderMessages = [];
  const recipientMessages = [];

  const senderSocket = createMockSocket(senderMessages);
  const recipientSocket = createMockSocket(recipientMessages);

  const connectionRegistry = {
    getUserConnection(userId) {
      return userId === "bob" ? recipientSocket : null;
    },
  };

  const data = {
    type: "FILE_START",
    from: "alice",
    payload: {
      transferId: "transfer-1",
      recipientId: "bob",
      fileName: "hello.txt",
      fileSize: 1024,
      totalChunks: 4,
      chunkSize: 256,
      mimeType: "text/plain",
      encryption: {
        wrappedKey: "ciphertext",
      },
      metadata: {
        note: "greeting",
      },
    },
    sig: undefined,
  };

  await FILE_START({
    socket: senderSocket,
    data,
    connectionRegistry,
    fastify: { log: { info() {}, error() {} } },
  });

  assert.equal(senderMessages.length, 1, "sender should receive one ACK message");
  const ackFrame = senderMessages[0];
  assert.equal(ackFrame.type, "FILE_START_ACK");
  assert.equal(ackFrame.payload.transferId, "transfer-1");
  assert.equal(ackFrame.payload.recipientId, "bob");
  assert.equal(ackFrame.payload.status, "initiated");
  assert.ok(ackFrame.payload.acknowledgedAt);

  assert.equal(recipientMessages.length, 1, "recipient should receive one offer message");
  const offerFrame = recipientMessages[0];
  assert.equal(offerFrame.type, "FILE_OFFER");
  assert.equal(offerFrame.payload.transferId, "transfer-1");
  assert.equal(offerFrame.payload.senderId, "alice");
  assert.equal(offerFrame.payload.fileName, "hello.txt");
  assert.equal(offerFrame.payload.totalChunks, 4);
  assert.equal(offerFrame.payload.chunkSize, 256);
  assert.equal(offerFrame.payload.metadata.note, "greeting");

  const storedTransfer = fileTransferRegistry.getTransfer("transfer-1");
  assert.ok(storedTransfer, "transfer should be stored in registry");
  assert.equal(storedTransfer.status, "initiated");
  assert.equal(storedTransfer.senderId, "alice");
  assert.equal(storedTransfer.recipientId, "bob");
  assert.equal(storedTransfer.fileSize, 1024);
});

test("FILE_START rejects duplicate transfer identifiers", async () => {
  const senderMessages = [];
  const senderSocket = createMockSocket(senderMessages);

  const data = {
    type: "FILE_START",
    from: "alice",
    payload: {
      transferId: "transfer-dup",
      recipientId: "bob",
      fileName: "dup.bin",
      fileSize: 512,
      totalChunks: 2,
    },
  };

  await FILE_START({
    socket: senderSocket,
    data,
    connectionRegistry: { getUserConnection() { return null; } },
    fastify: { log: { info() {}, error() {} } },
  });

  const secondMessages = [];
  const secondSocket = createMockSocket(secondMessages);

  await FILE_START({
    socket: secondSocket,
    data,
    connectionRegistry: { getUserConnection() { return null; } },
    fastify: { log: { info() {}, error() {} } },
  });

  assert.equal(secondMessages.length, 1, "duplicate transfer should produce an error");
  const errorFrame = secondMessages[0];
  assert.equal(errorFrame.type, "ERROR");
  assert.equal(errorFrame.payload.code, "FILE_TRANSFER_CONFLICT");
});

test("FILE_START validates payload", async () => {
  const messages = [];
  const socket = createMockSocket(messages);

  const badPayload = {
    type: "FILE_START",
    from: "alice",
    payload: {
      transferId: "",
      recipientId: "bob",
      fileName: "hello.txt",
      fileSize: -5,
      totalChunks: 0,
    },
  };

  await FILE_START({
    socket,
    data: badPayload,
    connectionRegistry: { getUserConnection() { return null; } },
    fastify: { log: { info() {}, error() {} } },
  });

  assert.equal(messages.length, 1);
  const errorFrame = messages[0];
  assert.equal(errorFrame.type, "ERROR");
  assert.equal(errorFrame.payload.code, "INVALID_FILE_START");
});
