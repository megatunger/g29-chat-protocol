"use strict";

const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {
  // Login endpoint
  fastify.post("/auth/login", async function (request, reply) {
    const { username, password } = request.body;

    // Basic validation
    if (!username || !password) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Username and password are required",
        statusCode: 400,
      });
    }

    try {
      // Find user in database
      const user = await prisma.client.findUnique({
        where: { userID: username },
      });

      if (!user) {
        return reply.code(401).send({
          error: "Unauthorized", 
          message: "Invalid credentials",
          statusCode: 401,
        });
      }

      // For now, simple password check (in real app, use hashed passwords)
      if (password !== "securepass123") {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Invalid credentials", 
          statusCode: 401,
        });
      }

      // Generate simple token (in real app, use JWT)
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

      return {
        message: "Login successful",
        user: {
          keyId: user.userID,
          pubkey: user.pubkey,
        },
        token: token,
      };

    } catch (error) {
      console.error("Login error:", error);
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Login failed",
        statusCode: 500,
      });
    }
  });
};