"use strict";

const { generateKeyPairSync } = require("node:crypto");

const toBase64Url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");

let publicChannelKeyPair;

function initializePublicChannelKeys() {
  if (publicChannelKeyPair) {
    return publicChannelKeyPair;
  }

  publicChannelKeyPair = generateKeyPairSync("rsa", {
    modulusLength: 4096,
  });

  return publicChannelKeyPair;
}

function getPublicChannelKeyPair() {
  if (!publicChannelKeyPair) {
    throw new Error("Public channel key pair has not been initialized");
  }

  return publicChannelKeyPair;
}

function getPublicChannelPublicKey() {
  const publicKeyDer = getPublicChannelKeyPair().publicKey.export({
    type: "spki",
    format: "der",
  });

  return toBase64Url(publicKeyDer);
}

module.exports = {
  initializePublicChannelKeys,
  getPublicChannelKeyPair,
  getPublicChannelPublicKey,
};
