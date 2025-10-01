"use strict";

function buildUserAdvertiseMessage({
  from,
  userId,
  serverId,
  metadata = {},
}) {
  if (typeof from !== "string" || from.length === 0) {
    throw new Error("buildUserAdvertiseMessage requires a from identifier");
  }
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("buildUserAdvertiseMessage requires a userId");
  }
  if (typeof serverId !== "string" || serverId.length === 0) {
    throw new Error("buildUserAdvertiseMessage requires a serverId");
  }

  return {
    type: "USER_ADVERTISE",
    from,
    to: "*",
    payload: {
      user_id: userId,
      server_id: serverId,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    },
  };
}

module.exports = {
  buildUserAdvertiseMessage,
};
