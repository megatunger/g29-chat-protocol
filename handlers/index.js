"use strict";

const ping = require("./ping");
const text = require("./text");
const userHello = require("./USER_HELLO");

const handlers = new Map([
  ["ping", ping],
  ["text", text],
  ["USER_HELLO", userHello],
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
