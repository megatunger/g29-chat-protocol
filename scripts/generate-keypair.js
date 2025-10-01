#!/usr/bin/env node
"use strict";

const fs = require("node:fs/promises");
const { mkdirSync, existsSync, chmodSync } = require("node:fs");
const path = require("node:path");
const { generateKeyPairSync, createPublicKey } = require("node:crypto");

const { toBase64Url } = require("../utilities/server-keys");

function parseArguments(argv = process.argv.slice(2)) {
  const result = { keyId: undefined, directory: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg.startsWith("--key-id=")) {
      result.keyId = arg.slice("--key-id=".length);
      continue;
    }

    if (arg === "--key-id") {
      result.keyId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      result.directory = arg.slice("--out-dir=".length);
      continue;
    }

    if (arg === "--out-dir") {
      result.directory = argv[index + 1];
      index += 1;
      continue;
    }

    if (!result.keyId) {
      result.keyId = arg;
    }
  }

  if (typeof result.keyId === "string") {
    result.keyId = result.keyId.trim();
  }

  if (!result.keyId) {
    throw new Error("Missing key id. Usage: yarn generate:keypair <key_id> [--out-dir ./keys]");
  }

  return result;
}

async function main() {
  const { keyId, directory: providedDirectory } = parseArguments();
  const baseDirectory = providedDirectory || path.join(__dirname, "..", "keys");
  const keyDirectory = path.join(baseDirectory, keyId);

  if (!existsSync(baseDirectory)) {
    mkdirSync(baseDirectory, { recursive: true });
  }

  if (existsSync(keyDirectory)) {
    throw new Error(`Key directory already exists: ${keyDirectory}`);
  }

  mkdirSync(keyDirectory, { recursive: true });

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicExponent: 0x10001,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
  });

  const privateKeyPath = path.join(keyDirectory, "private.pem");
  const publicKeyPath = path.join(keyDirectory, "public.pem");

  await Promise.all([
    fs.writeFile(privateKeyPath, privateKey, { encoding: "utf8" }),
    fs.writeFile(publicKeyPath, publicKey, { encoding: "utf8" }),
  ]);

  chmodSync(privateKeyPath, 0o600);

  const publicKeyDer = createPublicKey(publicKey).export({ type: "spki", format: "der" });
  const publicKeyBase64Url = toBase64Url(publicKeyDer);

  console.log(`Key pair created under ${keyDirectory}`);
  console.log(`BASE64URL(RSA-4096-PUB): ${publicKeyBase64Url}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
