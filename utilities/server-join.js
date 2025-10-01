"use strict";

const WebSocket = require("ws");

const {
  buildServerHelloJoinMessage,
} = require("../server-messages/SERVER_HELLO_JOIN");

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RECONNECT_OPTIONS = {
  enabled: true,
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
  multiplier: 2,
};

const reconnectStates = new Map();
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
        return resolve({ identifier, reused: true, socket: existing });
      } catch (error) {
        logger?.error?.(
          error,
          `Failed to reuse server connection for ${identifier}`,
        );
        return resolve({ identifier, reused: true, error });
      }
    }

    const url = `ws://${bootstrap.host}:${bootstrap.port}/chat`;
    logger?.info?.({ identifier, url }, "Connecting to peer server");
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
        const _message = JSON.stringify(message);
        logger.info?.(
          "Receiving message from another server: %s",
          _message?.substring(0, Math.min(_message.length, 128)),
        );
        ws.send(JSON.stringify(message));
        settle({ reused: false, socket: ws });
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

function resolveReconnectOptions(autoReconnect) {
  if (autoReconnect === false) {
    return { ...DEFAULT_RECONNECT_OPTIONS, enabled: false };
  }

  const resolved = {
    ...DEFAULT_RECONNECT_OPTIONS,
    ...(autoReconnect && typeof autoReconnect === "object"
      ? autoReconnect
      : {}),
  };

  resolved.enabled =
    typeof autoReconnect?.enabled === "boolean"
      ? autoReconnect.enabled
      : DEFAULT_RECONNECT_OPTIONS.enabled;
  resolved.initialDelayMs = Math.max(1, resolved.initialDelayMs || 1_000);
  resolved.multiplier = Math.max(1, resolved.multiplier || 1);
  resolved.maxDelayMs = Math.max(resolved.initialDelayMs, resolved.maxDelayMs || 60_000);

  return resolved;
}

function getReconnectState(identifier) {
  let state = reconnectStates.get(identifier);
  if (!state) {
    state = {
      attempts: 0,
      timer: null,
      connecting: false,
      config: null,
    };
    reconnectStates.set(identifier, state);
  }

  return state;
}

function attachReconnectListeners({ identifier, socket, state, config }) {
  if (!config.autoReconnect.enabled) {
    return;
  }

  if (socket.__autoReconnectIdentifier === identifier) {
    return;
  }

  const handleClose = (code, reason) => {
    if (typeof socket.__autoReconnectCleanup === "function") {
      socket.__autoReconnectCleanup();
    }
    socket.__autoReconnectIdentifier = null;
    scheduleReconnect({
      identifier,
      state,
      config,
      reason: { code, reason },
    });
  };

  const handleError = (error) => {
    config.logger?.error?.(
      error,
      `Peer server connection error for ${identifier}`,
    );
  };

  socket.once("close", handleClose);
  socket.on("error", handleError);
  socket.__autoReconnectIdentifier = identifier;
  socket.__autoReconnectCleanup = () => {
    socket.off("error", handleError);
  };
}

function scheduleReconnect({ identifier, state, config, reason }) {
  const { autoReconnect, logger } = config;
  if (!autoReconnect.enabled) {
    return;
  }

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  state.attempts += 1;
  const delay = Math.min(
    autoReconnect.initialDelayMs *
      Math.pow(autoReconnect.multiplier, Math.max(0, state.attempts - 1)),
    autoReconnect.maxDelayMs,
  );

  logger?.warn?.(
    { identifier, delay, attempts: state.attempts, reason },
    "Scheduling reconnect to peer server",
  );

  state.timer = setTimeout(() => {
    state.timer = null;
    attemptServerConnectionWithState(identifier, state, config).catch((error) => {
      logger?.error?.(error, `Unexpected error while reconnecting to ${identifier}`);
      scheduleReconnect({ identifier, state, config, reason: "retry_failure" });
    });
  }, delay);
}

async function attemptServerConnectionWithState(identifier, state, config) {
  if (state.connecting) {
    config.logger?.debug?.(
      { identifier },
      "Skipping reconnect attempt while one is already running",
    );
    return { identifier, skipped: true };
  }

  state.connecting = true;
  state.config = config;

  try {
    const result = await connectToServer({
      bootstrap: config.bootstrap,
      joinPayload: config.joinPayload,
      connectionRegistry: config.connectionRegistry,
      logger: config.logger,
      from: config.from,
      timeout: config.timeout,
    });

    if (result.error) {
      if (config.autoReconnect.enabled) {
        scheduleReconnect({
          identifier,
          state,
          config,
          reason: result.error?.message || "connection_error",
        });
      }
    } else if (!result.skipped) {
      state.attempts = 0;
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      if (result.socket) {
        attachReconnectListeners({ identifier, socket: result.socket, state, config });
      }
    }

    return result;
  } finally {
    state.connecting = false;
  }
}

async function connectToIntroducers({
  bootstrapServers,
  joinPayload,
  connectionRegistry,
  logger,
  from,
  timeout,
  autoReconnect,
}) {
  if (!Array.isArray(bootstrapServers) || bootstrapServers.length === 0) {
    return { successes: [], failures: [] };
  }

  const reconnectOptions = resolveReconnectOptions(autoReconnect);

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

    const identifier = makeServerIdentifier(bootstrap.host, bootstrap.port);
    const state = getReconnectState(identifier);
    const config = {
      bootstrap,
      joinPayload,
      connectionRegistry,
      logger,
      from,
      timeout,
      autoReconnect: reconnectOptions,
    };

    return attemptServerConnectionWithState(identifier, state, config);
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
