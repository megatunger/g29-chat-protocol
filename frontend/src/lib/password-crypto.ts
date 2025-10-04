import { encode, decode } from "base64url-universal";

const textEncoder = new TextEncoder();

const SALT_LENGTH_BYTES = 16;
const DERIVED_KEY_LENGTH_BYTES = 32;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_DIGEST = "SHA-256";

const ensureCrypto = (): Crypto => {
  const crypto = globalThis.crypto;
  if (!crypto) {
    throw new Error("WebCrypto API is not available");
  }
  return crypto;
};

const ensureSubtle = (): SubtleCrypto => {
  const subtle = ensureCrypto().subtle;
  if (!subtle) {
    throw new Error("WebCrypto subtle API is not available");
  }
  return subtle;
};

const importPasswordKey = (password: string): Promise<CryptoKey> =>
  ensureSubtle().importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

const derivePasswordBits = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
  length: number,
): Promise<Uint8Array> => {
  const key = await importPasswordKey(password);
  const bits = await ensureSubtle().deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: PBKDF2_DIGEST,
    },
    key,
    length * 8,
  );

  return new Uint8Array(bits);
};

const timingSafeEqual = (first: Uint8Array, second: Uint8Array): boolean => {
  if (first.length !== second.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < first.length; index += 1) {
    result |= first[index]! ^ second[index]!;
  }

  return result === 0;
};

export type PasswordVerifier = {
  algorithm: "pbkdf2";
  iterations: number;
  salt: string;
  hash: string;
  hashLength: number;
  digest: typeof PBKDF2_DIGEST;
};

export const hashPassword = async (
  password: string,
): Promise<PasswordVerifier> => {
  const crypto = ensureCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const hashBytes = await derivePasswordBits(
    password,
    salt,
    PBKDF2_ITERATIONS,
    DERIVED_KEY_LENGTH_BYTES,
  );

  return {
    algorithm: "pbkdf2",
    iterations: PBKDF2_ITERATIONS,
    salt: encode(salt),
    hash: encode(hashBytes),
    hashLength: DERIVED_KEY_LENGTH_BYTES,
    digest: PBKDF2_DIGEST,
  } satisfies PasswordVerifier;
};

export const verifyPassword = async (
  password: string,
  verifier: PasswordVerifier,
): Promise<boolean> => {
  if (verifier.algorithm !== "pbkdf2") {
    throw new Error(`Unsupported password verifier algorithm: ${verifier.algorithm}`);
  }

  if (verifier.digest !== PBKDF2_DIGEST) {
    throw new Error(`Unsupported password verifier digest: ${verifier.digest}`);
  }

  const salt = decode(verifier.salt);
  const expectedHash = decode(verifier.hash);

  const derived = await derivePasswordBits(
    password,
    new Uint8Array(salt),
    verifier.iterations,
    verifier.hashLength,
  );

  return timingSafeEqual(derived, new Uint8Array(expectedHash));
};
