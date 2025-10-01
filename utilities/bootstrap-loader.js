"use strict";

const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const DEFAULT_BOOTSTRAP_PATH = path.join(__dirname, "..", "bootstrap.yaml");

function normalizePort(port, index) {
  if (typeof port === "number") {
    return port;
  }

  if (typeof port === "string" && port.trim() !== "") {
    const parsed = Number.parseInt(port, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new Error(
    `bootstrap_servers[${index}].port must be a number or numeric string`
  );
}

function sanitizeServer(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`bootstrap_servers[${index}] must be an object`);
  }

  const host = typeof entry.host === "string" ? entry.host.trim() : "";
  if (!host) {
    throw new Error(`bootstrap_servers[${index}].host must be a non-empty string`);
  }

  const port = normalizePort(entry.port, index);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `bootstrap_servers[${index}].port must be an integer between 1 and 65535`
    );
  }

  const pubkey =
    typeof entry.pubkey === "string" ? entry.pubkey.trim() : undefined;
  if (!pubkey) {
    throw new Error(
      `bootstrap_servers[${index}].pubkey must be a non-empty string`
    );
  }

  return { host, port, pubkey };
}

function loadBootstrapServers(filePath = DEFAULT_BOOTSTRAP_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read bootstrap config at ${filePath}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = YAML.parse(raw) || {};
  } catch (error) {
    throw new Error(`Failed to parse bootstrap config: ${error.message}`);
  }

  const { bootstrap_servers: bootstrapServers } = parsed;
  if (!Array.isArray(bootstrapServers)) {
    throw new Error("bootstrap_servers must be an array in bootstrap.yaml");
  }

  return bootstrapServers.map(sanitizeServer);
}

module.exports = {
  loadBootstrapServers,
};
