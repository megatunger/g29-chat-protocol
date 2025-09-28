/**
 * Crypto utilities that satisfy SOCP v1.3 requirements using the WebCrypto API.
 *
 * The implementation provides RSA-4096 key generation, RSA-OAEP (SHA-256) encryption, and
 * RSASSA-PSS (SHA-256) signing/verification while keeping the public ChatCrypto API compatible
 * with the previous helper.
 */

import { decode, encode } from "base64url-universal";

export interface ChatKeyPair {
  publicKey: string; // base64url encoded DER (SPKI)
  privateKey: string; // base64url encoded DER (PKCS8)
  keyId: string; // caller-provided identifier or public key fingerprint fallback
}

type Envelope = {
  ciphertext: string; // base64url encoded RSA-OAEP ciphertext
  signature: string; // base64url encoded RSASSA-PSS signature
};

const RSA_PUBLIC_EXPONENT = new Uint8Array([0x01, 0x00, 0x01]);
const RSA_KEY_BITS = 4096;
const RSA_HASH = "SHA-256";
const RSA_PSS_SALT_LENGTH = 32;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const ensureSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "WebCrypto subtle API is not available in this environment",
    );
  }
  return subtle;
};

const toUint8Array = (input: ArrayBuffer | Uint8Array): Uint8Array =>
  input instanceof Uint8Array ? input : new Uint8Array(input);

const toBase64Url = (input: ArrayBuffer | Uint8Array): string =>
  encode(toUint8Array(input));

const fromBase64Url = (value: string): Uint8Array => decode(value);

const bufferToHex = (input: ArrayBuffer | Uint8Array): string => {
  const bytes = toUint8Array(input);
  let hex = "";
  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index].toString(16).padStart(2, "0");
  }
  return hex;
};

const RSA_KEY_GEN_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: RSA_KEY_BITS,
  publicExponent: RSA_PUBLIC_EXPONENT,
  hash: RSA_HASH,
};

const RSA_OAEP_IMPORT_PARAMS: RsaHashedImportParams = {
  name: "RSA-OAEP",
  hash: RSA_HASH,
};

const RSA_PSS_IMPORT_PARAMS: RsaHashedImportParams = {
  name: "RSA-PSS",
  hash: RSA_HASH,
};

const RSA_PSS_SIGN_PARAMS: RsaPssParams = {
  name: "RSA-PSS",
  saltLength: RSA_PSS_SALT_LENGTH,
};

const importPublicKeyForEncrypt = (key: string): Promise<CryptoKey> =>
  ensureSubtle().importKey(
    "spki",
    fromBase64Url(key),
    RSA_OAEP_IMPORT_PARAMS,
    false,
    ["encrypt"],
  );

const importPrivateKeyForDecrypt = (key: string): Promise<CryptoKey> =>
  ensureSubtle().importKey(
    "pkcs8",
    fromBase64Url(key),
    RSA_OAEP_IMPORT_PARAMS,
    false,
    ["decrypt"],
  );

const importPrivateKeyForSign = (key: string): Promise<CryptoKey> =>
  ensureSubtle().importKey(
    "pkcs8",
    fromBase64Url(key),
    RSA_PSS_IMPORT_PARAMS,
    false,
    ["sign"],
  );

const importPublicKeyForVerify = (key: string): Promise<CryptoKey> =>
  ensureSubtle().importKey(
    "spki",
    fromBase64Url(key),
    RSA_PSS_IMPORT_PARAMS,
    false,
    ["verify"],
  );

const parseEnvelope = (payload: string): Envelope => {
  let envelope: Envelope | null = null;
  try {
    envelope = JSON.parse(payload) as Envelope;
  } catch {
    throw new Error("Encrypted payload is not valid JSON");
  }

  if (!envelope || !envelope.ciphertext || !envelope.signature) {
    throw new Error("Encrypted payload is missing ciphertext or signature");
  }

  return envelope;
};

export class ChatCrypto {
  /**
   * Generate an RSA-4096 key pair suitable for SOCP. Keys are exported as DER bytes and
   * base64url encoded so they can be transported inside protocol messages.
   */
  static async generateKeyPair(userId: string): Promise<ChatKeyPair> {
    try {
      const subtle = ensureSubtle();
      const keyPair = await subtle.generateKey(RSA_KEY_GEN_PARAMS, true, [
        "encrypt",
        "decrypt",
      ]);

      if (!keyPair.privateKey || !keyPair.publicKey) {
        throw new Error("Key generation returned incomplete key material");
      }

      const publicKeyDer = await subtle.exportKey("spki", keyPair.publicKey);
      const privateKeyDer = await subtle.exportKey("pkcs8", keyPair.privateKey);
      const fingerprintBytes = await subtle.digest(RSA_HASH, publicKeyDer);
      const fingerprint = bufferToHex(fingerprintBytes);
      const keyId = userId && userId.trim().length > 0 ? userId : fingerprint;

      return {
        publicKey: toBase64Url(publicKeyDer),
        privateKey: toBase64Url(privateKeyDer),
        keyId,
      };
    } catch (error) {
      throw new Error(
        `Key generation failed: ${ChatCrypto.describeError(error)}`,
      );
    }
  }

  /**
   * Encrypt plaintext with the recipient's public key (RSA-OAEP SHA-256) and sign the plaintext
   * with the sender's private key (RSASSA-PSS SHA-256). The returned envelope is JSON encoded to
   * preserve backwards compatibility with the previous string-based API.
   */
  static async encryptAndSign(
    message: string,
    recipientPublicKey: string,
    senderPrivateKey: string,
  ): Promise<string> {
    try {
      const subtle = ensureSubtle();
      const encryptionKey = await importPublicKeyForEncrypt(recipientPublicKey);
      const signingKey = await importPrivateKeyForSign(senderPrivateKey);
      const messageBytes = textEncoder.encode(message);

      const ciphertext = await subtle.encrypt(
        { name: "RSA-OAEP" },
        encryptionKey,
        messageBytes,
      );

      const signature = await subtle.sign(
        RSA_PSS_SIGN_PARAMS,
        signingKey,
        messageBytes,
      );

      return JSON.stringify({
        ciphertext: toBase64Url(ciphertext),
        signature: toBase64Url(signature),
      } satisfies Envelope);
    } catch (error) {
      throw new Error(`Encryption failed: ${ChatCrypto.describeError(error)}`);
    }
  }

  /**
   * Decrypt an envelope produced by encryptAndSign. Returns the UTF-8 plaintext along with a
   * boolean that reflects whether the RSASSA-PSS signature verified successfully.
   */
  static async decryptAndVerify(
    encryptedMessage: string,
    recipientPrivateKey: string,
    senderPublicKey: string,
  ): Promise<{ message: string; verified: boolean }> {
    const envelope = parseEnvelope(encryptedMessage);

    try {
      const subtle = ensureSubtle();
      const privateKey = await importPrivateKeyForDecrypt(recipientPrivateKey);
      const publicKey = await importPublicKeyForVerify(senderPublicKey);
      const ciphertext = fromBase64Url(envelope.ciphertext);
      const signature = fromBase64Url(envelope.signature);

      const decrypted = await subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        ciphertext,
      );

      const decryptedBytes = toUint8Array(decrypted);
      const verified = await subtle.verify(
        RSA_PSS_SIGN_PARAMS,
        publicKey,
        signature,
        decryptedBytes,
      );

      return {
        message: textDecoder.decode(decryptedBytes),
        verified,
      };
    } catch (error) {
      throw new Error(`Decryption failed: ${ChatCrypto.describeError(error)}`);
    }
  }

  /**
   * Derive the SHA-256 fingerprint for the provided public key. This acts as a deterministic key
   * identifier and is aligned with the SOCP requirement that identifiers are UUID/unique values.
   */
  static async getKeyId(publicKey: string): Promise<string> {
    try {
      const subtle = ensureSubtle();
      const fingerprint = await subtle.digest(
        RSA_HASH,
        fromBase64Url(publicKey),
      );
      return bufferToHex(fingerprint);
    } catch (error) {
      throw new Error(
        `Failed to compute key ID: ${ChatCrypto.describeError(error)}`,
      );
    }
  }

  /**
   * Validate whether a base64url encoded DER key can be parsed either as a public or private key.
   */
  static async validateKey(encodedKey: string): Promise<boolean> {
    const subtle = ensureSubtle();
    try {
      await subtle.importKey(
        "spki",
        fromBase64Url(encodedKey),
        RSA_OAEP_IMPORT_PARAMS,
        false,
        ["encrypt"],
      );
      return true;
    } catch {
      try {
        await subtle.importKey(
          "pkcs8",
          fromBase64Url(encodedKey),
          RSA_OAEP_IMPORT_PARAMS,
          false,
          ["decrypt"],
        );
        return true;
      } catch {
        try {
          await subtle.importKey(
            "spki",
            fromBase64Url(encodedKey),
            RSA_PSS_IMPORT_PARAMS,
            false,
            ["verify"],
          );
          return true;
        } catch {
          try {
            await subtle.importKey(
              "pkcs8",
              fromBase64Url(encodedKey),
              RSA_PSS_IMPORT_PARAMS,
              false,
              ["sign"],
            );
            return true;
          } catch {
            return false;
          }
        }
      }
    }
  }

  /**
   * Produce a detached RSASSA-PSS (SHA-256) signature over the supplied UTF-8 payload. The
   * signature is encoded as base64url so it can be dropped directly into protocol frames.
   */
  static async signPayload(
    payload: string,
    privateKey: string,
  ): Promise<string> {
    try {
      const subtle = ensureSubtle();

      const signingKey = await importPrivateKeyForSign(privateKey);
      const payloadBytes = textEncoder.encode(payload);

      const signature = await subtle.sign(
        RSA_PSS_SIGN_PARAMS,
        signingKey,
        payloadBytes,
      );

      return toBase64Url(signature);
    } catch (error) {
      throw new Error(
        `Failed to sign payload: ${ChatCrypto.describeError(error)}`,
      );
    }
  }

  /**
   * Verify a detached RSASSA-PSS (SHA-256) signature over the supplied UTF-8 payload using the
   * sender's public key. The signature is expected to be base64url encoded.
   */
  static async verifyPayloadSignature(
    payload: string,
    publicKey: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const subtle = ensureSubtle();
      const verificationKey = await importPublicKeyForVerify(publicKey);
      const payloadBytes = textEncoder.encode(payload);
      const signatureBytes = fromBase64Url(signature);

      return await subtle.verify(
        RSA_PSS_SIGN_PARAMS,
        verificationKey,
        signatureBytes,
        payloadBytes,
      );
    } catch {
      return false;
    }
  }

  private static describeError(error: unknown): string {
    if (typeof DOMException !== "undefined" && error instanceof DOMException) {
      return `${error.name}: ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
