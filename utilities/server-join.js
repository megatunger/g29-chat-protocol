"use strict";

const WebSocket = require("ws");

const {
  buildServerHelloJoinMessage,
} = require("../server-messages/SERVER_HELLO_JOIN");
const {
  prepareServerMessageEnvelope,
  parseMessage,
} = require("./message-utils");

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PUBLIC_HOST = process.env.SERVER_PUBLIC_HOST || "localhost";
const DEFAULT_PORT_FALLBACKS = [
  process.env.SERVER_PUBLIC_PORT,
  process.env.PORT,
  3000,
];

function pickPort(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value > 0 && value <= 65_535) {
      return value;
    }
    return undefined;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535) {
      return parsed;
    }
  }

  return undefined;
}

function sanitizeHost(candidate, fallback = DEFAULT_PUBLIC_HOST) {
  if (typeof candidate !== "string") {
    return fallback;
  }

  const normalized = candidate.trim();
  if (!normalized || normalized.includes("::") || normalized === "0.0.0.0") {
    return fallback;
  }

  return normalized;
}

function parseAddressInfo(addressInfo) {
  if (!addressInfo) {
    return { host: undefined, port: undefined };
  }

  if (typeof addressInfo === "string") {
    try {
      const url = new URL(addressInfo);
      return {
        host: url.hostname,
        port: pickPort(url.port),
      };
    } catch (_error) {
      return { host: undefined, port: undefined };
    }
  }

  if (typeof addressInfo === "object") {
    return {
      host: addressInfo.address,
      port: pickPort(addressInfo.port),
    };
  }

  return { host: undefined, port: undefined };
}

function resolveServerAddress({
  fastify,
  defaultHost = DEFAULT_PUBLIC_HOST,
  defaultPortCandidates = DEFAULT_PORT_FALLBACKS,
} = {}) {
  const addressInfo =
    typeof fastify?.server?.address === "function"
      ? fastify.server.address()
      : null;

  const parsed = parseAddressInfo(addressInfo);
  const host = sanitizeHost(parsed.host, defaultHost);

  const port =
    [parsed.port, ...defaultPortCandidates]
      .map((value) => pickPort(value))
      .find((value) => value !== undefined) ?? 3000;

  return { host, port };
}

function resolveServerJoinPayload({
  fastify,
  serverIdentity = fastify?.serverIdentity,
  preferDecorated = true,
  defaultHost = DEFAULT_PUBLIC_HOST,
  defaultPortCandidates = DEFAULT_PORT_FALLBACKS,
} = {}) {
  if (preferDecorated && fastify && typeof fastify === "object") {
    const decorated = fastify.serverJoinPayload;
    const decoratedPort = pickPort(decorated?.port);
    if (
      decorated &&
      typeof decorated === "object" &&
      typeof decorated.host === "string" &&
      decorated.host.trim() &&
      decoratedPort &&
      typeof decorated.pubkey === "string" &&
      decorated.pubkey.trim()
    ) {
      return {
        host: decorated.host,
        port: decoratedPort,
        pubkey: decorated.pubkey,
      };
    }
  }

  const pubkey = serverIdentity?.publicKeyBase64Url;
  if (typeof pubkey !== "string" || !pubkey.trim()) {
    return null;
  }

  const { host, port } = resolveServerAddress({
    fastify,
    defaultHost,
    defaultPortCandidates,
  });

  if (!host || !port) {
    return null;
  }

  return { host, port, pubkey };
}

function makeServerIdentifier(host, port) {
  return `${host}:${port}`;
}

function normalizeHost(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim().toLowerCase();
}

function hostsMatch(left, right) {
  const normalizedLeft = normalizeHost(left);
  const normalizedRight = normalizeHost(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

function attachLifecycleHooks(socket, identifier, connectionRegistry, logger) {
  if (socket.__connectionRegistryHooksAttached) {
    return;
  }

  socket.__connectionRegistryHooksAttached = true;

  socket.on("close", () => {
    connectionRegistry.unregisterServerSocket(socket);
    logger?.info?.({ identifier }, "Server connection closed");
  });

  socket.on("error", (error) => {
    logger?.error?.(error, `Server connection error for ${identifier}`);
  });
}

function attachServerMessageDispatcher(socket, {
  fastify,
  connectionRegistry,
  logger,
}) {
  if (!socket || typeof socket.on !== "function") {
    return;
  }

  if (socket.__serverMessageDispatcherAttached) {
    return;
  }

  socket.__serverMessageDispatcherAttached = true;

  socket.on("message", async (rawMessage) => {
    const parsed = parseMessage(rawMessage);
    if (parsed.error) {
      logger?.warn?.(
        { error: parsed.error },
        "Received invalid message from server",
      );
      return;
    }

    let handlersModule;
    try {
      handlersModule = require("../handlers");
    } catch (error) {
      logger?.error?.(error, "Failed to load handlers module");
      return;
    }

    const handler =
      typeof handlersModule?.getHandler === "function"
        ? handlersModule.getHandler(parsed.type)
        : undefined;
    if (!handler) {
      logger?.warn?.(
        { type: parsed.type },
        "Received unsupported server message type",
      );
      return;
    }

    try {
      await handler({
        socket,
        data: parsed,
        meta: parsed.meta,
        fastify,
        connectionRegistry,
      });
    } catch (error) {
      logger?.error?.(
        error,
        `Server message handler failed for type ${parsed.type}`,
      );
    }
  });
}

function connectToServer({
  bootstrap,
  joinPayload,
  connectionRegistry,
  logger,
  from,
  timeout = DEFAULT_TIMEOUT_MS,
  serverIdentity,
  fastify,
}) {
  return new Promise((resolve) => {
    const identifier = makeServerIdentifier(bootstrap.host, bootstrap.port);
    const message = prepareServerMessageEnvelope({
      message: buildServerHelloJoinMessage({
        from,
        to: identifier,
        payload: joinPayload,
      }),
      serverIdentity,
    });

    const existing = connectionRegistry.getServerConnection(identifier);
    if (existing && existing.readyState === WebSocket.OPEN) {
      attachServerMessageDispatcher(existing, {
        fastify,
        connectionRegistry,
        logger,
      });
      try {
        existing.send(JSON.stringify(message));
        return resolve({ identifier, reused: true });
      } catch (error) {
        logger?.error?.(
          error,
          `Failed to reuse server connection for ${identifier}`,
        );
        return resolve({ identifier, reused: true, error });
      }
    }

    const url = `ws://${bootstrap.host}:${bootstrap.port}/chat`;
    logger.info("Listening on %s", url);
    const ws = new WebSocket(url);
    let settled = false;

    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve({ identifier, ...result });
      }
    };

    const timeoutId = setTimeout(() => {
      ws.terminate();
      settle({
        error: new Error(
          `Timed out connecting to ${identifier} after ${timeout}ms`,
        ),
      });
    }, timeout);

    ws.once("open", () => {
      clearTimeout(timeoutId);
      try {
        connectionRegistry.registerServerConnection(identifier, ws);
        attachLifecycleHooks(ws, identifier, connectionRegistry, logger);
        attachServerMessageDispatcher(ws, {
          fastify,
          connectionRegistry,
          logger,
        });
        const _message = JSON.stringify(message);
        logger.info?.(
          "Receiving message from another server: %s",
          _message?.substring(0, Math.min(_message.length, 128)),
        );
        ws.send(JSON.stringify(message));
        settle({ reused: false });
      } catch (error) {
        logger?.error?.(
          error,
          `Failed during SERVER_HELLO_JOIN for ${identifier}`,
        );
        settle({ error });
      }
    });

    ws.once("error", (error) => {
      clearTimeout(timeoutId);
      logger?.error?.(
        error,
        `WebSocket error while connecting to ${identifier}`,
      );
      settle({ error });
    });
  });
}

async function connectToIntroducers({
  bootstrapServers,
  joinPayload,
  connectionRegistry,
  logger,
  from,
  timeout,
  serverIdentity,
  fastify,
}) {
  if (!Array.isArray(bootstrapServers) || bootstrapServers.length === 0) {
    return { successes: [], failures: [] };
  }

  const tasks = bootstrapServers.map((bootstrap) => {
    const matchesHost =
      joinPayload && hostsMatch(joinPayload.host, bootstrap.host);
    const matchesPort =
      joinPayload &&
      Number.parseInt(joinPayload.port, 10) ===
        Number.parseInt(bootstrap.port, 10);
    const matchesKey =
      joinPayload?.pubkey && bootstrap.pubkey
        ? joinPayload.pubkey === bootstrap.pubkey
        : false;

    if ((matchesHost && matchesPort) || matchesKey) {
      logger?.debug?.(
        { bootstrap },
        "Skipping bootstrap server that matches local identity",
      );
      return Promise.resolve({
        identifier: makeServerIdentifier(bootstrap.host, bootstrap.port),
        skipped: true,
      });
    }

    return connectToServer({
      bootstrap,
      joinPayload,
      connectionRegistry,
      logger,
      from,
      timeout,
      serverIdentity,
      fastify,
    });
  });

  const results = await Promise.all(tasks);
  const successes = results.filter(
    (result) => !result.error && !result.skipped,
  );
  const failures = results.filter((result) => result.error);
  const skipped = results.filter((result) => result.skipped);

  return { successes, failures, skipped };
}

module.exports = {
  connectToIntroducers,
  makeServerIdentifier,
  hostsMatch,
  resolveServerAddress,
  resolveServerJoinPayload,
};
