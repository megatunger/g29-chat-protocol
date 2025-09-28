"use strict";

const { send, sendError } = require("../utilities/message-utils");
const { PrismaClient } = require("../generated/prisma");
const { verifyStoredUserSignature } = require("../utilities/signature-utils");
const defaultRegistry = require("../utilities/connection-registry");

const prisma = new PrismaClient();

module.exports = async function MSG_DIRECT(props) {
  const { socket, data, fastify, connectionRegistry = defaultRegistry } = props;

  if (!data) {
    throw new Error("Missing message data");
  }

  if (!data.from || typeof data.from !== "string") {
    throw new Error("Missing userID in 'from' field");
  }

  if (!data.payload || typeof data.payload !== "object") {
    throw new Error("Missing payload for MSG_DIRECT");
  }

  const { payload } = data;
  const { recipientId, ciphertext, content_sig: contentSig, sender_pub: senderPub, timestamp } =
    payload;

  if (!recipientId || typeof recipientId !== "string") {
    sendError(socket, "INVALID_RECIPIENT", "recipientId must be provided");
    return;
  }

  if (!ciphertext || typeof ciphertext !== "string") {
    sendError(socket, "INVALID_CIPHERTEXT", "Direct messages require ciphertext");
    return;
  }

  if (!senderPub || typeof senderPub !== "string") {
    sendError(socket, "INVALID_SENDER_PUB", "Sender public key is required");
    return;
  }

  if (!contentSig || typeof contentSig !== "string") {
    sendError(socket, "INVALID_CONTENT_SIG", "content_sig must be provided");
    return;
  }

  try {
    const { valid, user } = await verifyStoredUserSignature({
      prismaClient: prisma,
      userId: data.from,
      payload,
      signature: data.sig,
    });

    if (!valid) {
      sendError(socket, "INVALID_SIG", "Signature invalid");
      return;
    }

    if (user?.pubkey && user.pubkey !== senderPub) {
      sendError(socket, "MISMATCHED_PUBKEY", "Sender public key mismatch");
      return;
    }

    const recipientSocket = connectionRegistry.getUserConnection(recipientId);
    const normalizedTimestamp =
      typeof timestamp === "number" ? timestamp : Date.now();

    let deliveryStatus = "recipient_unavailable";
    let deliveryError = null;

    const isRecipientOpen =
      recipientSocket &&
      (typeof recipientSocket.readyState !== "number" ||
        recipientSocket.readyState === 1 ||
        recipientSocket.readyState === recipientSocket.OPEN);

    if (recipientSocket && isRecipientOpen) {
      try {
        send(recipientSocket, {
          type: "USER_DELIVER",
          from: "server",
          to: recipientId,
          payload: {
            senderId: data.from,
            sender_pub: senderPub,
            ciphertext,
            content_sig: contentSig,
            timestamp: normalizedTimestamp,
          },
        });
        deliveryStatus = "delivered";
      } catch (error) {
        deliveryStatus = "delivery_failed";
        deliveryError = error;
        if (fastify?.log) {
          fastify.log.error(error, "Failed to deliver USER_DELIVER frame");
        }
      }
    }

    const ackPayload = {
      recipientId,
      status: deliveryStatus,
      content_sig: contentSig,
      updatedAt: new Date().toISOString(),
    };

    if (deliveryStatus === "recipient_unavailable") {
      ackPayload.note =
        "Recipient not connected locally. TODO: forward to remote server.";
    }

    if (deliveryStatus === "delivery_failed") {
      ackPayload.error =
        deliveryError?.message || "Failed to send direct message";
    }

    send(socket, {
      type: "MSG_DIRECT_ACK",
      from: "server",
      to: data.from,
      payload: ackPayload,
    });
  } catch (error) {
    if (fastify?.log) {
      fastify.log.error(error, "Failed to handle MSG_DIRECT");
    }
    sendError(
      socket,
      "INTERNAL_ERROR",
      error?.message || "Failed to deliver direct message",
    );
  }
};

