"use strict";

const defaultRegistry = require("../utilities/connection-registry");

module.exports = function USER_ADVERTISE({
  data,
  connectionRegistry = defaultRegistry,
}) {
  if (!data || typeof data !== "object") {
    throw new Error("USER_ADVERTISE requires message data");
  }

  const payload = data.payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("USER_ADVERTISE requires a payload object");
  }

  const userId = payload.user_id;
  const serverId = payload.server_id;

  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("USER_ADVERTISE payload.user_id must be a string");
  }
  if (typeof serverId !== "string" || serverId.length === 0) {
    throw new Error("USER_ADVERTISE payload.server_id must be a string");
  }

  const advertisedLocation = `server_${serverId}`;
  const existingLocation =
    typeof connectionRegistry.getUserLocation === "function"
      ? connectionRegistry.getUserLocation(userId)
      : null;

  if (existingLocation !== "local") {
    connectionRegistry.setUserLocation(userId, advertisedLocation);
  }

  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? payload.metadata
      : null;

  if (metadata) {
    connectionRegistry.setUserMetadata(userId, metadata);
  }
};
