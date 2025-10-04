"use strict";

const { generateKeyPairSync } = require("node:crypto");

let publicChannelKeyPair;

function initializePublicChannelKeys() {
  if (publicChannelKeyPair) {
    return publicChannelKeyPair;
  }

  publicChannelKeyPair = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
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
  return getPublicChannelKeyPair().publicKey;
}

module.exports = {
  initializePublicChannelKeys,
  getPublicChannelKeyPair,
  getPublicChannelPublicKey,
};
