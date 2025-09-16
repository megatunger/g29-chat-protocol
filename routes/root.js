"use strict";

module.exports = async function (fastify, opts) {
  fastify.get(
    "/",
    {
      websocket: true,
    },
    async function (request, reply) {
      return { root: true };
    },
  );
};
