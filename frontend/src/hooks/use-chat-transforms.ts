"use client";

import { useCallback } from "react";

import { ChatCrypto } from "@/lib/crypto";

type DirectMessageTransformInput = {
  message: string;
  recipientPublicKey: string;
  senderPrivateKey: string;
  senderId: string;
  recipientId: string;
  timestamp: number;
};

type DirectMessageTransformResult = {
  ciphertext: string;
  /** RSASSA-PSS signature over the ciphertext|from|to|ts tuple */
  contentSignature: string;
  timestamp: number;
};

type DirectMessageDecryptionInput = {
  ciphertext: string;
  senderPublicKey: string;
  recipientPrivateKey: string;
  contentSignature?: string | null;
  senderId?: string | null;
  recipientId?: string | null;
  timestamp?: number | null;
};

type DirectMessageDecryptionResult = {
  message: string;
  /** Whether the ciphertext signature verified against the sender's public key */
  contentSignatureValid: boolean;
};

type ParsedEnvelope = {
  ciphertext: string;
  signature: string;
};

const parseEnvelope = (envelopeJson: string): ParsedEnvelope => {
  try {
    const parsed = JSON.parse(envelopeJson) as {
      ciphertext?: string;
      signature?: string;
    } | null;

    if (
      !parsed ||
      typeof parsed.ciphertext !== "string" ||
      !parsed.ciphertext ||
      typeof parsed.signature !== "string" ||
      !parsed.signature
    ) {
      throw new Error("Missing ciphertext in encrypted envelope");
    }

    return { ciphertext: parsed.ciphertext, signature: parsed.signature };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unexpected encryption envelope";
    throw new Error(`Failed to prepare ciphertext: ${reason}`);
  }
};

const useChatTransforms = () => {
  const createDirectMessagePayload = useCallback(
    async (
      input: DirectMessageTransformInput,
    ): Promise<DirectMessageTransformResult> => {
      const {
        message,
        recipientPublicKey,
        senderPrivateKey,
        senderId,
        recipientId,
        timestamp,
      } = input;

      if (!message || !message.trim()) {
        throw new Error("Cannot send an empty direct message");
      }

      if (!recipientPublicKey) {
        throw new Error("Recipient public key is required for encryption");
      }

      if (!senderPrivateKey) {
        throw new Error("Sender private key is required for signing");
      }

      const envelope = await ChatCrypto.encryptAndSign(
        message,
        recipientPublicKey,
        senderPrivateKey,
      );

      const parsedEnvelope = parseEnvelope(envelope);
      // The legacy envelope includes a plaintext signature that we intentionally drop.
      const { ciphertext } = parsedEnvelope;

      if (!senderId) {
        throw new Error("Sender identifier is required for direct messages");
      }

      if (!recipientId) {
        throw new Error("Recipient identifier is required for direct messages");
      }

      if (!Number.isFinite(timestamp)) {
        throw new Error("Timestamp is required for direct messages");
      }

      const signaturePayload = `${ciphertext}|${senderId}|${recipientId}|${timestamp}`;

      const contentSignature = await ChatCrypto.signPayload(
        signaturePayload,
        senderPrivateKey,
      );

      return {
        ciphertext,
        contentSignature,
        timestamp,
      };
    },
    [],
  );

  const decryptDirectMessagePayload = useCallback(
    async (
      input: DirectMessageDecryptionInput,
    ): Promise<DirectMessageDecryptionResult> => {
      const {
        ciphertext,
        senderPublicKey,
        recipientPrivateKey,
        contentSignature,
        senderId,
        recipientId,
        timestamp,
      } = input;

      if (!ciphertext) {
        throw new Error("Encrypted direct message is missing ciphertext");
      }

      if (!senderPublicKey) {
        throw new Error("Missing sender public key for direct message");
      }

      if (!recipientPrivateKey) {
        throw new Error("Missing recipient private key for direct message");
      }

      let contentSignatureValid = false;
      if (contentSignature) {
        const hasMetadata =
          typeof senderId === "string" &&
          senderId.length > 0 &&
          typeof recipientId === "string" &&
          recipientId.length > 0 &&
          typeof timestamp === "number" &&
          Number.isFinite(timestamp);

        const payload = hasMetadata
          ? `${ciphertext}|${senderId}|${recipientId}|${timestamp}`
          : ciphertext;

        // The signature protects the encrypted bytes and addressing metadata,
        // so verify before decrypting
        contentSignatureValid = await ChatCrypto.verifyPayloadSignature(
          payload,
          senderPublicKey,
          contentSignature,
        );
      }

      const message = await ChatCrypto.decryptCiphertext(
        ciphertext,
        recipientPrivateKey,
      );

      return {
        message,
        contentSignatureValid,
      };
    },
    [],
  );

  return {
    createDirectMessagePayload,
    decryptDirectMessagePayload,
  };
};

export type {
  DirectMessageTransformInput,
  DirectMessageTransformResult,
  DirectMessageDecryptionInput,
  DirectMessageDecryptionResult,
};
export default useChatTransforms;
