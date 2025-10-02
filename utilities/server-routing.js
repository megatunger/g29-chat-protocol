"use strict";

const {
  resolveServerJoinPayload,
  makeServerIdentifier,
  hostsMatch,
} = require("./server-join");

function parseServerIdentifier(identifier) {
  if (typeof identifier !== "string") {
    return { host: null, port: null };
  }

  const trimmed = identifier.trim();
  if (!trimmed) {
    return { host: null, port: null };
  }

  if (trimmed.includes("://")) {
    try {
      const url = new URL(trimmed);
      const port = url.port ? Number.parseInt(url.port, 10) : Number.NaN;
      return {
        host: url.hostname || null,
        port: Number.isInteger(port) ? port : null,
      };
    } catch (_error) {
      // Fall through to manual parsing.
    }
  }

  if (trimmed.startsWith("[")) {
    const closingBracketIndex = trimmed.indexOf("]");
    if (closingBracketIndex > 0) {
      const hostPart = trimmed.slice(1, closingBracketIndex);
      const remainder = trimmed.slice(closingBracketIndex + 1);
      let port = null;
      if (remainder.startsWith(":")) {
        const parsedPort = Number.parseInt(remainder.slice(1), 10);
        if (Number.isInteger(parsedPort)) {
          port = parsedPort;
        }
      }
      return { host: hostPart || null, port };
    }
  }

  const lastColonIndex = trimmed.lastIndexOf(":");
  if (lastColonIndex > 0 && lastColonIndex < trimmed.length - 1) {
    const hostPart = trimmed.slice(0, lastColonIndex);
    const portPart = trimmed.slice(lastColonIndex + 1);
    const parsedPort = Number.parseInt(portPart, 10);
    return {
      host: hostPart || null,
      port: Number.isInteger(parsedPort) ? parsedPort : null,
    };
  }

  return { host: trimmed || null, port: null };
}

function getLocalRoutingMetadata(fastify) {
  const joinPayload = resolveServerJoinPayload({ fastify }) || null;
  const identifier =
    joinPayload &&
    typeof joinPayload.host === "string" &&
    joinPayload.host &&
    Number.isInteger(joinPayload.port)
      ? makeServerIdentifier(joinPayload.host, joinPayload.port)
      : null;

  return { joinPayload, identifier };
}

function isSameServer({
  serverId,
  localServerId,
  localJoinPayload,
  localIdentifier,
  socket,
}) {
  if (typeof serverId !== "string" || !serverId.trim()) {
    return false;
  }

  if (localServerId && serverId === localServerId) {
    return true;
  }

  if (localIdentifier && serverId === localIdentifier) {
    return true;
  }

  const candidate = parseServerIdentifier(serverId);
  const localHost = localJoinPayload?.host;
  const localPort = Number.isInteger(localJoinPayload?.port)
    ? localJoinPayload.port
    : null;

  const hostMatches =
    localHost && candidate.host && hostsMatch(candidate.host, localHost);
  const portMatches =
    localPort &&
    candidate.port &&
    Number.parseInt(candidate.port, 10) === Number.parseInt(localPort, 10);

  if (hostMatches && (!candidate.port || portMatches)) {
    return true;
  }

  const socketAddress = socket?._socket?.remoteAddress;
  const socketPort = socket?._socket?.remotePort;

  const socketHostMatches =
    localHost && socketAddress && hostsMatch(socketAddress, localHost);
  const socketPortMatches =
    localPort &&
    socketPort &&
    Number.parseInt(socketPort, 10) === Number.parseInt(localPort, 10);

  if (socketHostMatches && (!socketPort || socketPortMatches)) {
    return true;
  }

  return false;
}

module.exports = {
  parseServerIdentifier,
  getLocalRoutingMetadata,
  isSameServer,
};
