"use strict";

const { send } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

module.exports = async function USER_HELLO(props) {
  const { socket, data, meta } = props;
  console.log("[USER_HELLO] Request: ", data);
  
  if (!data.payload) {
    throw new Error("Missing payload");
  }

  if (!data.from) {
    throw new Error("Missing userID in 'from' field");
  }

  try {
    await prisma.client.upsert({
      where: {
        userID: data.from,
      },
      update: {
        pubkey: data.payload.pubkey,
        version: data.payload.client || "unknown",
        isActive: true, 
        ts: new Date(),
      },
      create: {
        userID: data.from,
        pubkey: data.payload.pubkey,
        version: data.payload.client || "unknown", 
        isActive: true,  
      },
    });

    console.log(`✅ User ${data.from} is now ACTIVE in database`);


    send(socket, {
      type: "ACK",
      from: "server",
      to: data.from,
      payload: {
        message: "Welcome to the chat!",
      },
    });


    socket.on('close', async () => {
      try {
        await prisma.client.update({
          where: { userID: data.from },
          data: { isActive: false },  
        });
        console.log(`User ${data.from} is now INACTIVE (disconnected)`);
      } catch (error) {
        console.error( error);
      }
    });

  } catch (error) {
    console.error("Database error:", error);
    throw new Error(`Failed to store user: ${error.message}`);
  }
};
