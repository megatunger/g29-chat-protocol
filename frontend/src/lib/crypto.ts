/**
 * Simple crypto wrapper using OpenPGP.js
 * Handles RSA key generation, encryption, and signing for chat
 */

import * as openpgp from "openpgp";
import { Buffer } from "buffer";

export interface ChatKeyPair {
  publicKey: string; // Base64-encoded armored public key
  privateKey: string; // Base64-encoded armored private key
  keyId: string; // Unique identifier
}

const hasBuffer = typeof Buffer !== "undefined";

const encodeBase64 = (value: string): string => {
  if (hasBuffer) {
    return Buffer.from(value, "utf-8").toString("base64");
  }

  if (
    typeof globalThis.TextEncoder !== "undefined" &&
    typeof globalThis.btoa === "function"
  ) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return globalThis.btoa(binary);
  }

  throw new Error("Base64 encoding is not supported in this environment");
};

const decodeBase64 = (value: string): string => {
  if (value.includes("-----BEGIN PGP")) {
    return value;
  }

  try {
    if (hasBuffer) {
      const decoded = Buffer.from(value, "base64").toString("utf-8");
      return decoded.includes("-----BEGIN PGP") ? decoded : value;
    }

    if (
      typeof globalThis.TextDecoder !== "undefined" &&
      typeof globalThis.atob === "function"
    ) {
      const binary = globalThis.atob(value);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const decoder = new TextDecoder();
      const decoded = decoder.decode(bytes);
      return decoded.includes("-----BEGIN PGP") ? decoded : value;
    }
  } catch (error) {
    console.warn(
      "Failed to decode base64 key; returning original value",
      error,
    );
  }

  return value;
};

export class ChatCrypto {
  /**
   * Generate new RSA-4096 key pair for a user
   */
  static async generateKeyPair(userID: string): Promise<ChatKeyPair> {
    try {
      const { publicKey, privateKey } = await openpgp.generateKey({
        type: "rsa",
        rsaBits: 4096,
        userIDs: [{ name: userID }],
        format: "armored",
      });

      const keyId = userID.toString();

      return {
        publicKey: encodeBase64(publicKey),
        privateKey: encodeBase64(privateKey),
        keyId,
      };
    } catch (error) {
      throw new Error(`Key generation failed: ${error}`);
    }
  }

  /**
   * Encrypt and sign a message
   */
  static async encryptAndSign(
    message: string,
    recipientPublicKey: string,
    senderPrivateKey: string,
  ): Promise<string> {
    try {
      const recipientArmored = decodeBase64(recipientPublicKey);
      const senderArmored = decodeBase64(senderPrivateKey);

      const publicKey = await openpgp.readKey({
        armoredKey: recipientArmored,
      });
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({
          armoredKey: senderArmored,
        }),
        passphrase: "", // We'll add passphrase support later
      });

      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: message }),
        encryptionKeys: publicKey,
        signingKeys: privateKey,
        format: "armored",
      });

      return encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt and verify a message
   */
  static async decryptAndVerify(
    encryptedMessage: string,
    recipientPrivateKey: string,
    senderPublicKey: string,
  ): Promise<{ message: string; verified: boolean }> {
    try {
      const recipientArmored = decodeBase64(recipientPrivateKey);
      const senderArmored = decodeBase64(senderPublicKey);

      const message = await openpgp.readMessage({
        armoredMessage: encryptedMessage,
      });
      const publicKey = await openpgp.readKey({ armoredKey: senderArmored });
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({
          armoredKey: recipientArmored,
        }),
        passphrase: "",
      });

      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKey,
        format: "utf8",
      });

      let verified = false;
      if (signatures.length > 0) {
        try {
          await signatures[0].verified;
          verified = true;
        } catch (e) {
          verified = false;
        }
      }

      return {
        message: decrypted,
        verified,
      };
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Extract key ID from public key
   */
  static async getKeyId(publicKey: string): Promise<string> {
    try {
      const decoded = decodeBase64(publicKey);
      const key = await openpgp.readKey({ armoredKey: decoded });
      return key.getKeyID().toHex();
    } catch (error) {
      throw new Error(`Failed to get key ID: ${error}`);
    }
  }

  /**
   * Validate if a key is properly formatted
   */
  static async validateKey(armoredBase64Key: string): Promise<boolean> {
    try {
      const decoded = decodeBase64(armoredBase64Key);
      await openpgp.readKey({ armoredKey: decoded });
      return true;
    } catch (error) {
      return false;
    }
  }
}
