"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ChatCrypto, type ChatKeyPair } from "@/lib/crypto";
import { decryptPrivateKey, encryptPrivateKey } from "@/lib/key-encryption";
import {
  hashPassword,
  verifyPassword,
  type PasswordVerifier,
} from "@/lib/password-crypto";
import { useAuthStore } from "@/stores/auth.store";

type NewKeyContextValue = {
  storedKey: ChatKeyPair | null;
  isProcessing: boolean;
  error: string | null;
  generateKey: (userId: string) => Promise<ChatKeyPair | null>;
  sign: (message: string) => Promise<string>;
  loadKey: (
    password: string,
    expectedKeyId?: string,
  ) => Promise<ChatKeyPair | null>;
  saveKey: (key: ChatKeyPair, password: string) => Promise<void>;
};

const NewKeyContext = createContext<NewKeyContextValue | null>(null);

const NewKeyProvider = ({ children }: PropsWithChildren) => {
  const encryptedKey = useAuthStore((state) => state.encryptedKey);
  const decryptedPrivateKey = useAuthStore(
    (state) => state.decryptedPrivateKey,
  );
  const setEncryptedKey = useAuthStore((state) => state.setEncryptedKey);
  const setDecryptedPrivateKey = useAuthStore(
    (state) => state.setDecryptedPrivateKey,
  );
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedKey = useMemo<ChatKeyPair | null>(() => {
    if (!encryptedKey || !decryptedPrivateKey) {
      return null;
    }

    return {
      publicKey: encryptedKey.publicKey,
      privateKey: decryptedPrivateKey,
      keyId: encryptedKey.keyId,
    } satisfies ChatKeyPair;
  }, [encryptedKey, decryptedPrivateKey]);

  const generateKey = useCallback(
    async (userId: string): Promise<ChatKeyPair | null> => {
      try {
        setIsProcessing(true);
        setError(null);

        const keyPair = await ChatCrypto.generateKeyPair(userId);

        return keyPair;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate key";
        setError(message);
        console.error("generateKey failed:", err);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const saveKey = useCallback(
    async (key: ChatKeyPair, password: string): Promise<void> => {
      try {
        setIsProcessing(true);
        setError(null);

        const encryptedPrivateKey = await encryptPrivateKey(
          key.privateKey,
          password,
        );
        const passwordVerifier = await hashPassword(password);

        setEncryptedKey({
          publicKey: key.publicKey,
          encryptedPrivateKey: encryptedPrivateKey.ciphertext,
          keyId: key.keyId,
          salt: encryptedPrivateKey.salt,
          iv: encryptedPrivateKey.iv,
          version: encryptedPrivateKey.version,
          passwordVerifier,
        });
        setDecryptedPrivateKey(key.privateKey);
        setLoggedIn(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to store key";
        setError(message);
        console.error("saveKey failed:", err);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [setEncryptedKey, setDecryptedPrivateKey, setLoggedIn],
  );

  const loadKey = useCallback(
    async (
      password: string,
      expectedKeyId?: string,
    ): Promise<ChatKeyPair | null> => {
      const currentEncrypted = useAuthStore.getState().encryptedKey;
      if (!currentEncrypted) {
        return null;
      }

      if (expectedKeyId && currentEncrypted.keyId !== expectedKeyId) {
        setError(
          "Stored key belongs to a different user. Generate a new key to proceed.",
        );
        return null;
      }

      try {
        setIsProcessing(true);
        setError(null);

        const passwordVerifier: PasswordVerifier | null =
          currentEncrypted.passwordVerifier ?? null;

        if (passwordVerifier) {
          const isMatch = await verifyPassword(password, passwordVerifier);
          if (!isMatch) {
            setError("Incorrect password");
            setDecryptedPrivateKey(null);
            setLoggedIn(false);
            return null;
          }
        }

        const privateKey = await decryptPrivateKey(
          {
            ciphertext: currentEncrypted.encryptedPrivateKey,
            salt: currentEncrypted.salt,
            iv: currentEncrypted.iv,
            version: currentEncrypted.version,
          },
          password,
        );

        setDecryptedPrivateKey(privateKey);
        setLoggedIn(true);

        return {
          publicKey: currentEncrypted.publicKey,
          privateKey,
          keyId: currentEncrypted.keyId,
        } satisfies ChatKeyPair;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to unlock private key";
        setError(message);
        setDecryptedPrivateKey(null);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [setDecryptedPrivateKey, setLoggedIn],
  );

  const sign = useCallback(
    async (message: unknown) => {
      if (!storedKey || !storedKey.privateKey) {
        throw new Error("Key not found!");
      }
      if (!message) {
        throw new Error("Message was empty!");
      }
      return await ChatCrypto.signPayload(
        JSON.stringify(message),
        storedKey.privateKey,
      );
    },
    [storedKey],
  );

  const value = useMemo<NewKeyContextValue>(
    () => ({
      storedKey,
      isProcessing,
      error,
      generateKey,
      loadKey,
      saveKey,
      sign,
    }),
    [storedKey, isProcessing, error, generateKey, loadKey, saveKey, sign],
  );

  return (
    <NewKeyContext.Provider value={value}>{children}</NewKeyContext.Provider>
  );
};

const useNewKey = () => {
  const context = useContext(NewKeyContext);
  if (!context) {
    throw new Error("useNewKey must be used within a NewKeyProvider");
  }
  return context;
};

export { NewKeyProvider, useNewKey };
