"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ChatCrypto, ChatKeyPair } from "@/lib/crypto";
import { useAuthStore } from "@/stores/auth.store";

export type KeyStatus = "none" | "generating" | "ready" | "error";

export interface UserInfo {
  name: string;
  email: string;
}

type KeyContextValue = {
  keyStatus: KeyStatus;
  userKeys: ChatKeyPair | null;
  userInfo: UserInfo | null;
  error: string | null;

  // Key management actions
  generateKeys: (userInfo: UserInfo) => Promise<void>;
  generateKeysAuto: (userId: string) => Promise<void>; // For automatic generation during login
  loadExistingKeys: () => Promise<void>;
  clearKeys: () => void;

  // Crypto operations
  encryptMessage: (
    message: string,
    recipientPublicKey: string,
  ) => Promise<string>;
  decryptMessage: (
    encryptedMessage: string,
    senderPublicKey: string,
  ) => Promise<{ message: string; verified: boolean }>;

  // Utility functions
  hasKeys: boolean;
  getPublicKey: () => string | null;
  isGenerating: boolean;
};

const KeyContext = createContext<KeyContextValue | null>(null);

const KeyProvider = ({ children }: PropsWithChildren) => {
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("none");
  const [userKeys, setLocalUserKeys] = useState<ChatKeyPair | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storedUserKeys = useAuthStore((state) => state.userKeys);
  const setPersistedUserKeys = useAuthStore((state) => state.setUserKeys);
  const clearPersistedUserKeys = useAuthStore((state) => state.clearUserKeys);

  const applyKeys = useCallback(
    async (keys: ChatKeyPair, info?: UserInfo) => {
      const isValid = await ChatCrypto.validateKey(keys.publicKey);
      if (!isValid) {
        clearPersistedUserKeys();
        throw new Error("Stored keys are invalid");
      }

      setLocalUserKeys(keys);
      setUserInfo(info ?? { name: "User", email: "user@example.com" });
      setKeyStatus("ready");
    },
    [clearPersistedUserKeys],
  );

  useEffect(() => {
    if (!storedUserKeys) {
      setLocalUserKeys(null);
      setUserInfo(null);
      setKeyStatus("none");
      setError(null);
      return;
    }

    const rehydrate = async () => {
      try {
        setKeyStatus("generating");
        setError(null);
        await applyKeys(storedUserKeys);
      } catch (err) {
        console.error("Failed to load existing keys:", err);
        setError(err instanceof Error ? err.message : "Failed to load keys");
        setKeyStatus("error");
      }
    };

    rehydrate();
  }, [applyKeys, storedUserKeys]);

  const generateKeys = useCallback(
    async (info: UserInfo) => {
      try {
        setKeyStatus("generating");
        setError(null);
        setUserInfo(info);

        const newKeys = await ChatCrypto.generateKeyPair(info.name, info.email);
        await applyKeys(newKeys, info);
        setPersistedUserKeys(newKeys);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate keys";
        setError(errorMessage);
        setKeyStatus("error");
        console.error("Key generation failed:", err);
      }
    },
    [applyKeys, setPersistedUserKeys],
  );

  const generateKeysAuto = useCallback(
    async (userId: string) => {
      try {
        setKeyStatus("generating");
        setError(null);

        const info: UserInfo = { name: userId, email: `${userId}@chat.local` };
        const newKeys = await ChatCrypto.generateKeyPair(info.name, info.email);

        await applyKeys(newKeys, info);
        setPersistedUserKeys(newKeys);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate keys";
        setError(errorMessage);
        setKeyStatus("error");
        console.error("Automatic key generation failed:", err);
      }
    },
    [applyKeys, setPersistedUserKeys],
  );

  const loadExistingKeys = useCallback(async () => {
    try {
      setKeyStatus("generating");
      setError(null);

      const stored = useAuthStore.getState().userKeys;
      if (!stored) {
        setKeyStatus("none");
        return;
      }

      await applyKeys(stored);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load keys";
      setError(errorMessage);
      setKeyStatus("error");
      console.error("Failed to load keys:", err);
    }
  }, [applyKeys]);

  const clearKeys = useCallback(() => {
    clearPersistedUserKeys();
    setLocalUserKeys(null);
    setUserInfo(null);
    setKeyStatus("none");
    setError(null);
  }, [clearPersistedUserKeys]);

  const encryptMessage = useCallback(
    async (message: string, recipientPublicKey: string): Promise<string> => {
      if (!userKeys) {
        throw new Error("No user keys available for signing");
      }

      try {
        return await ChatCrypto.encryptAndSign(
          message,
          recipientPublicKey,
          userKeys.privateKey,
        );
      } catch (err) {
        throw new Error(
          `Encryption failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [userKeys],
  );

  const decryptMessage = useCallback(
    async (
      encryptedMessage: string,
      senderPublicKey: string,
    ): Promise<{ message: string; verified: boolean }> => {
      if (!userKeys) {
        throw new Error("No user keys available for decryption");
      }

      try {
        return await ChatCrypto.decryptAndVerify(
          encryptedMessage,
          userKeys.privateKey,
          senderPublicKey,
        );
      } catch (err) {
        throw new Error(
          `Decryption failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [userKeys],
  );

  const getPublicKey = useCallback((): string | null => {
    return userKeys?.publicKey || null;
  }, [userKeys]);

  const hasKeys = useMemo(() => {
    return keyStatus === "ready" && userKeys !== null;
  }, [keyStatus, userKeys]);

  const isGenerating = useMemo(() => {
    return keyStatus === "generating";
  }, [keyStatus]);

  const value = useMemo<KeyContextValue>(
    () => ({
      keyStatus,
      userKeys,
      userInfo,
      error,
      generateKeys,
      generateKeysAuto,
      loadExistingKeys,
      clearKeys,
      encryptMessage,
      decryptMessage,
      hasKeys,
      getPublicKey,
      isGenerating,
    }),
    [
      keyStatus,
      userKeys,
      userInfo,
      error,
      generateKeys,
      generateKeysAuto,
      loadExistingKeys,
      clearKeys,
      encryptMessage,
      decryptMessage,
      hasKeys,
      getPublicKey,
      isGenerating,
    ],
  );

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
};

const useKeys = () => {
  const context = useContext(KeyContext);
  if (!context) {
    throw new Error("useKeys must be used within a KeyProvider");
  }
  return context;
};

export { KeyProvider, useKeys };
