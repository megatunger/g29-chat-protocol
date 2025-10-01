"use strict";

const WebSocket = require("ws");

const { buildServerHelloJoinMessage } = require("../server-messages/SERVER_HELLO_JOIN");

const DEFAULT_TIMEOUT_MS = 10_000;

function makeServerIdentifier(host, port) {
  return `${host}:${port}`;
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
        logger?.error?.(error, `Failed to reuse server connection for ${identifier}`);
        return resolve({ identifier, reused: true, error });
      }
    }

    const url = `ws://${bootstrap.host}:${bootstrap.port}/chat`;
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
        error: new Error(`Timed out connecting to ${identifier} after ${timeout}ms`),
      });
    }, timeout);

    ws.once("open", () => {
      clearTimeout(timeoutId);
      try {
        connectionRegistry.registerServerConnection(identifier, ws);
        attachLifecycleHooks(ws, identifier, connectionRegistry, logger);
        ws.send(JSON.stringify(message));
        settle({ reused: false });
      } catch (error) {
        logger?.error?.(error, `Failed during SERVER_HELLO_JOIN for ${identifier}`);
        settle({ error });
      }
    });

    ws.once("error", (error) => {
      clearTimeout(timeoutId);
      logger?.error?.(error, `WebSocket error while connecting to ${identifier}`);
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
    if (
      joinPayload &&
      joinPayload.host === bootstrap.host &&
      Number(joinPayload.port) === Number(bootstrap.port)
    ) {
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
  const successes = results.filter((result) => !result.error && !result.skipped);
  const failures = results.filter((result) => result.error);
  const skipped = results.filter((result) => result.skipped);

  return { successes, failures, skipped };
}

module.exports = {
  connectToIntroducers,
  makeServerIdentifier,
};
