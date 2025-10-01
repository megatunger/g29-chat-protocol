"use strict";

const WebSocket = require("ws");

const {
  buildServerHelloJoinMessage,
} = require("../server-messages/SERVER_HELLO_JOIN");

const DEFAULT_TIMEOUT_MS = 10_000;
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

function connectToServer({
  bootstrap,
  joinPayload,
  connectionRegistry,
  logger,
  from,
  timeout = DEFAULT_TIMEOUT_MS,
}) {
  return new Promise((resolve) => {
    const identifier = makeServerIdentifier(bootstrap.host, bootstrap.port);
    const message = buildServerHelloJoinMessage({
      from,
      to: identifier,
      payload: joinPayload,
    });

    const existing = connectionRegistry.getServerConnection(identifier);
    if (existing && existing.readyState === WebSocket.OPEN) {
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
        logger.info?.(JSON.stringify(message));
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
};
