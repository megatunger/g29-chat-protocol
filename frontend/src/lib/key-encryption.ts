import { encode, decode } from "base64url-universal";

const textEncoder = new TextEncoder();

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = "SHA-256";
const AES_KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERSION = 1;

const ensureCrypto = (): Crypto => {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return globalThis.crypto;
};

const ensureSubtle = (): SubtleCrypto => {
  const subtle = ensureCrypto().subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle API is not available");
  }
  return subtle;
};

const getPasswordKey = async (password: string): Promise<CryptoKey> => {
  if (!password || password.length === 0) {
    throw new Error("Password is required to protect the private key");
  }

  return ensureSubtle().importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
};

const deriveAesKey = async (
  passwordKey: CryptoKey,
  salt: Uint8Array,
): Promise<CryptoKey> => {
  return ensureSubtle().deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: AES_KEY_LENGTH,
    },
    false,
    ["encrypt", "decrypt"],
  );
};

export type EncryptedPrivateKey = {
  ciphertext: string; // base64url AES-GCM ciphertext (contains auth tag)
  salt: string; // base64url PBKDF2 salt
  iv: string; // base64url AES-GCM IV
  version: number;
};

export const encryptPrivateKey = async (
  privateKey: string,
  password: string,
): Promise<EncryptedPrivateKey> => {
  const crypto = ensureCrypto();
  const passwordKey = await getPasswordKey(password);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const aesKey = await deriveAesKey(passwordKey, salt);

  const ciphertext = await ensureSubtle().encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    decode(privateKey),
  );

  return {
    ciphertext: encode(new Uint8Array(ciphertext)),
    salt: encode(salt),
    iv: encode(iv),
    version: VERSION,
  };
};

export const decryptPrivateKey = async (
  encrypted: EncryptedPrivateKey,
  password: string,
): Promise<string> => {
  const passwordKey = await getPasswordKey(password);
  const salt = decode(encrypted.salt);
  const iv = decode(encrypted.iv);
  const aesKey = await deriveAesKey(passwordKey, salt);

  try {
    const decrypted = await ensureSubtle().decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      aesKey,
      decode(encrypted.ciphertext),
    );

    return encode(new Uint8Array(decrypted));
  } catch (error) {
    const reason =
      error instanceof DOMException ? `${error.name}: ${error.message}` : "";
    throw new Error(
      reason
        ? `Failed to decrypt private key: ${reason}`
        : "Failed to decrypt private key",
    );
  }
};
