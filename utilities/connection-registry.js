"use strict";

const userSockets = new Map();
let socketToUser = new WeakMap();

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
  const userId = socketToUser.get(socket);
  if (!userId) {
    return false;
  }

  if (userSockets.get(userId) === socket) {
    userSockets.delete(userId);
  }

  return socketToUser.delete(socket);
}

function listActiveUsers() {
  return Array.from(userSockets.keys());
}

function getAllConnections() {
  return userSockets;
}

function clearAll() {
  userSockets.clear();
  socketToUser = new WeakMap();
}

module.exports = {
  registerUserConnection,
  getUserConnection,
  getUserIdBySocket,
  unregisterUser,
  unregisterSocket,
  listActiveUsers,
  getAllConnections,
  clearAll,
};
