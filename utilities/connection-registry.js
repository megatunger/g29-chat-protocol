"use strict";

const WebSocket = require("ws");

const { send } = require("./message-utils");

const userSockets = new Map();
const serverSockets = new Map();
const userLocations = new Map();
const userMetadata = new Map();
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
  setUserLocation(userId, "local");

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
  removeUserLocation(userId);
  removeUserMetadata(userId);
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
    removeUserLocation(userId);
    removeUserMetadata(userId);
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

  return removed;
}

function listActiveUsers() {
  return Array.from(userSockets.keys());
}

function getAllConnections() {
  return userSockets;
}

function getAllServerConnections() {
  return serverSockets;
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

function clearAll() {
  userSockets.clear();
  serverSockets.clear();
  userLocations.clear();
  userMetadata.clear();
  socketToUser = new WeakMap();
  socketToServer = new WeakMap();
}

function setUserLocation(userId, location) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("setUserLocation requires a userId string");
  }

  if (typeof location !== "string" || location.length === 0) {
    throw new Error("setUserLocation requires a location string");
  }

  userLocations.set(userId, location);
}

function getUserLocation(userId) {
  return userLocations.get(userId) || null;
}

function removeUserLocation(userId) {
  if (!userId) {
    return false;
  }

  return userLocations.delete(userId);
}

function listUserLocations() {
  return Array.from(userLocations.entries());
}

function setUserMetadata(userId, metadata) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("setUserMetadata requires a userId string");
  }

  if (!metadata || typeof metadata !== "object") {
    userMetadata.delete(userId);
    return;
  }

  userMetadata.set(userId, metadata);
}

function getUserMetadata(userId) {
  return userMetadata.get(userId) || null;
}

function removeUserMetadata(userId) {
  if (!userId) {
    return false;
  }

  return userMetadata.delete(userId);
}

function listUserMetadata() {
  return Array.from(userMetadata.entries());
}

function broadcastToServers(message, options = {}) {
  const exclude = options.exclude || [];
  const excludeSet = new Set(
    Array.isArray(exclude) ? exclude.filter(Boolean) : [exclude].filter(Boolean),
  );

  for (const [serverId, socket] of serverSockets.entries()) {
    if (excludeSet.has(serverId)) {
      continue;
    }

    if (!socket || typeof socket.send !== "function") {
      continue;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    try {
      send(socket, message);
    } catch (error) {
      console.warn(
        `Failed to broadcast message to server ${serverId}: ${error.message}`,
      );
    }
  }
}

module.exports = {
  registerUserConnection,
  getUserConnection,
  getUserIdBySocket,
  unregisterUser,
  unregisterSocket,
  listActiveUsers,
  getAllConnections,
  getAllServerConnections,
  registerServerConnection,
  getServerConnection,
  getServerIdBySocket,
  unregisterServer,
  unregisterServerSocket,
  listActiveServers,
  clearAll,
  setUserLocation,
  getUserLocation,
  removeUserLocation,
  listUserLocations,
  setUserMetadata,
  getUserMetadata,
  removeUserMetadata,
  listUserMetadata,
  broadcastToServers,
};
