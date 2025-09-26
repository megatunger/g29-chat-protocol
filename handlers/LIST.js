"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

module.exports = async function LIST(props) {
  const { socket, data, meta } = props;
  console.log("[LIST] Request from:", data.from);

  try {

    const activeUsers = await prisma.client.findMany({
      where: {
        isActive: true,  
      },
      select: {
        userID: true,
        version: true,
        ts: true,
      },
      orderBy: {
        ts: 'desc', 
      },
    });

    console.log(`Found ${activeUsers.length} ACTIVE users`);


    send(socket, {
      type: "USER_LIST",
      from: "server",
      to: data.from,
      payload: {
        users: activeUsers,
        total: activeUsers.length,
        message: `Found ${activeUsers.length} active users online`,
      },
    });

  } catch (error) {
    console.error("Database error:", error);
    send(socket, {
      type: "ERROR",
      from: "server", 
      to: data.from,
      payload: {
        code: "DATABASE_ERROR",
        detail: "Failed to retrieve users from database",
      },
    });
  }
};