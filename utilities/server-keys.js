"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { accessSync, constants } = require("node:fs");
const { createPublicKey } = require("node:crypto");

const DEFAULT_KEYS_DIR = path.join(__dirname, "..", "keys");

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function normalizeKeyId(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeDirectory(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function pickFirstDefined(...candidates) {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }

  return undefined;
}

function extractKeyIdFromArgv(argv = process.argv) {
  if (!Array.isArray(argv)) {
    return undefined;
  }

  const flags = ["server-key-id", "serverKeyId"];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (typeof arg !== "string") {
      continue;
    }

    for (const flag of flags) {
      const prefix = `--${flag}=`;
      if (arg.startsWith(prefix)) {
        return normalizeKeyId(arg.slice(prefix.length));
      }

      if (arg === `--${flag}` || arg === `-${flag}`) {
        const next = argv[index + 1];
        return normalizeKeyId(next);
      }
    }
  }

  return undefined;
}

function resolveServerKeyOptions({
  env = process.env,
  argv = process.argv,
  options = {},
  defaultDirectory = DEFAULT_KEYS_DIR,
} = {}) {
  const optionKeyId = normalizeKeyId(options.serverKeyId || options.keyId);
  const envKeyId = normalizeKeyId(env.SERVER_KEY_ID);
  const cliKeyId = normalizeKeyId(extractKeyIdFromArgv(argv));
  const keyId = normalizeKeyId(pickFirstDefined(optionKeyId, cliKeyId, envKeyId));

  if (!keyId) {
    throw new Error(
      "Missing server key id. Provide --server-key-id, options.serverKeyId, or SERVER_KEY_ID",
    );
  }

  const optionDirectory = normalizeDirectory(
    options.serverKeysDir || options.keyDirectory || options.keysDirectory,
  );
  const envDirectory = normalizeDirectory(env.SERVER_KEYS_DIR);
  const baseDirectory =
    normalizeDirectory(pickFirstDefined(optionDirectory, envDirectory, defaultDirectory)) ||
    DEFAULT_KEYS_DIR;

  const keyDirectory = path.join(baseDirectory, keyId);

  return { keyId, keyDirectory };
}

async function ensureFileReadable(filePath) {
  try {
    accessSync(filePath, constants.R_OK);
  } catch (error) {
    const reason = error?.message ? ` (${error.message})` : "";
    throw new Error(`Key file not accessible: ${filePath}${reason}`);
  }
}

async function loadServerKeyPair({ keyId, keyDirectory } = {}) {
  if (!keyId || !keyDirectory) {
    throw new Error("loadServerKeyPair requires keyId and keyDirectory");
  }

  const privateKeyPath = path.join(keyDirectory, "private.pem");
  const publicKeyPath = path.join(keyDirectory, "public.pem");

  await Promise.all([ensureFileReadable(privateKeyPath), ensureFileReadable(publicKeyPath)]);

  const [privateKeyPem, publicKeyPem] = await Promise.all([
    fs.readFile(privateKeyPath, "utf8"),
    fs.readFile(publicKeyPath, "utf8"),
  ]);

  if (!privateKeyPem.trim()) {
    throw new Error(`Private key file is empty: ${privateKeyPath}`);
  }

  if (!publicKeyPem.trim()) {
    throw new Error(`Public key file is empty: ${publicKeyPath}`);
  }

  const publicKeyObject = createPublicKey(publicKeyPem);
  const publicKeyDer = publicKeyObject.export({ type: "spki", format: "der" });
  const publicKeyBase64Url = toBase64Url(publicKeyDer);

  return {
    keyId,
    directory: keyDirectory,
    privateKey: privateKeyPem,
    publicKey: publicKeyPem,
    publicKeyBase64Url,
  };
}

module.exports = {
  loadServerKeyPair,
  resolveServerKeyOptions,
  toBase64Url,
};
