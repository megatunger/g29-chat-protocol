"use strict";

const userSockets = new Map();
const serverSockets = new Map();
const serverOrigins = new Map();
let socketToUser = new WeakMap();
let socketToServer = new WeakMap();

function registerUserConnection(userId, socket) {
  if (!userId || typeof userId !== "string") {
    throw new Error("registerUserConnection requires a userId string");
  }
  if (!socket || typeof socket.send !== "function") {
    throw new Error("registerUserConnection requires a valid WebSocket instance");
  }

  const existingSocket = userSockets.get(userId);
  if (existingSocket && existingSocket !== socket) {
    socketToUser.delete(existingSocket);
  }

  userSockets.set(userId, socket);
  socketToUser.set(socket, userId);

  return socket;
}

function getUserConnection(userId) {
  return userSockets.get(userId) || null;
}

function getUserIdBySocket(socket) {
  return socketToUser.get(socket) || null;
}

function unregisterUser(userId) {
  const socket = userSockets.get(userId);
  if (!socket) {
    return false;
  }
  if (socketToUser.get(socket) === userId) {
    socketToUser.delete(socket);
  }
  return userSockets.delete(userId);
}

function unregisterSocket(socket) {
  let removed = false;

  const userId = socketToUser.get(socket);
  if (userId) {
    if (userSockets.get(userId) === socket) {
      userSockets.delete(userId);
    }
    socketToUser.delete(socket);
    removed = true;
  }

  const serverId = socketToServer.get(socket);
  if (serverId) {
    if (serverSockets.get(serverId) === socket) {
      serverSockets.delete(serverId);
    }
    socketToServer.delete(socket);
    removed = true;
  }

  if (typeof socket?.__registeredServerOrigin === "string") {
    serverOrigins.delete(socket.__registeredServerOrigin);
  }

  return removed;
}

function listActiveUsers() {
  return Array.from(userSockets.keys());
}

function getAllConnections() {
  return userSockets;
}

function registerServerConnection(serverId, socket) {
  if (!serverId || typeof serverId !== "string") {
    throw new Error("registerServerConnection requires a serverId string");
  }
  if (!socket || typeof socket.send !== "function") {
    throw new Error("registerServerConnection requires a valid WebSocket instance");
  }

  const existingSocket = serverSockets.get(serverId);
  if (existingSocket && existingSocket !== socket) {
    socketToServer.delete(existingSocket);
  }

  serverSockets.set(serverId, socket);
  socketToServer.set(socket, serverId);

  return socket;
}

function getServerConnection(serverId) {
  return serverSockets.get(serverId) || null;
}

function getServerIdBySocket(socket) {
  return socketToServer.get(socket) || null;
}

function unregisterServer(serverId) {
  const socket = serverSockets.get(serverId);
  if (!socket) {
    return false;
  }

  if (socketToServer.get(socket) === serverId) {
    socketToServer.delete(socket);
  }

  return serverSockets.delete(serverId);
}

function unregisterServerSocket(socket) {
  const serverId = socketToServer.get(socket);
  if (!serverId) {
    return false;
  }

  if (serverSockets.get(serverId) === socket) {
    serverSockets.delete(serverId);
  }

  return socketToServer.delete(socket);
}

function listActiveServers() {
  return Array.from(serverSockets.keys());
}

function registerServerOrigin(originAddress, targetAddress, socket) {
  if (!originAddress || typeof originAddress !== "string") {
    throw new Error("registerServerOrigin requires an originAddress string");
  }

  const normalizedOrigin = originAddress.trim();
  if (!normalizedOrigin) {
    throw new Error("registerServerOrigin originAddress must not be empty");
  }

  const normalizedTarget =
    typeof targetAddress === "string" ? targetAddress.trim() : null;

  const record = {
    target: normalizedTarget,
    lastSeen: Date.now(),
  };

  serverOrigins.set(normalizedOrigin, record);

  if (socket && typeof socket === "object") {
    socket.__registeredServerOrigin = normalizedOrigin;
  }

  return record;
}

function unregisterServerOrigin(originAddress) {
  if (!originAddress || typeof originAddress !== "string") {
    return false;
  }

  return serverOrigins.delete(originAddress.trim());
}

function listServerOrigins() {
  return Array.from(serverOrigins.entries()).map(([origin, record]) => ({
    origin,
    ...record,
  }));
}

function clearAll() {
  userSockets.clear();
  serverSockets.clear();
  serverOrigins.clear();
  socketToUser = new WeakMap();
  socketToServer = new WeakMap();
}

module.exports = {
  registerUserConnection,
  getUserConnection,
  getUserIdBySocket,
  unregisterUser,
  unregisterSocket,
  listActiveUsers,
  getAllConnections,
  registerServerConnection,
  getServerConnection,
  getServerIdBySocket,
  unregisterServer,
  unregisterServerSocket,
  listActiveServers,
  registerServerOrigin,
  unregisterServerOrigin,
  listServerOrigins,
  clearAll,
};
