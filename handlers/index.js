"use strict";

const ping = require("./ping");
const text = require("./text");
const USER_HELLO = require("./USER_HELLO");
const LIST = require("./LIST");
const MSG_DIRECT = require("./MSG_DIRECT");
const HEARTBEAT = require("./HEARTBEAT");
const MSG_PUBLIC_CHANNEL = require("./MSG_PUBLIC_CHANNEL");
const PUBLIC_CHANNEL_KEY_SHARE = require("./PUBLIC_CHANNEL_KEY_SHARE");
const SERVER_HELLO_JOIN = require("./SERVER_HELLO_JOIN");
const USER_ADVERTISE = require("./USER_ADVERTISE");

const handlers = new Map([
  ["ping", ping],
  ["text", text],
  ["USER_HELLO", USER_HELLO],
  ["LIST", LIST],
  ["HEARTBEAT", HEARTBEAT],
  ["MSG_DIRECT", MSG_DIRECT],
  ["MSG_PUBLIC_CHANNEL", MSG_PUBLIC_CHANNEL],
  ["PUBLIC_CHANNEL_KEY_SHARE", PUBLIC_CHANNEL_KEY_SHARE],
  ["SERVER_HELLO_JOIN", SERVER_HELLO_JOIN],
  ["USER_ADVERTISE", USER_ADVERTISE],
]);

function getHandler(type) {
  return handlers.get(type);
}

function registerHandler(type, handler) {
  if (typeof type !== "string" || !type) {
    throw new Error("Handler type must be a non-empty string");
  }
  if (typeof handler !== "function") {
    throw new Error("Handler must be a function");
  }
  handlers.set(type, handler);
}

module.exports = {
  getHandler,
  registerHandler,
};
