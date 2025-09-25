"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";
import { ChatCrypto, type ChatKeyPair } from "@/lib/crypto";
import { useAuthStore } from "@/stores/auth.store";

type NewKeyContextValue = {
  storedKey: ChatKeyPair | null;
  isProcessing: boolean;
  error: string | null;
  generateKey: (userId: string) => Promise<ChatKeyPair | null>;
  loadKey: () => ChatKeyPair | null;
  saveKey: (key: ChatKeyPair) => void;
};

const NewKeyContext = createContext<NewKeyContextValue | null>(null);

const NewKeyProvider = ({ children }: PropsWithChildren) => {
  const storedKey = useAuthStore((state) => state.userKey);
  const setUserKey = useAuthStore((state) => state.setUserKey);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKey = useCallback((): ChatKeyPair | null => {
    return useAuthStore.getState().userKey;
  }, []);

  const saveKey = useCallback(
    (key: ChatKeyPair) => {
      setUserKey(key);
    },
    [setUserKey],
  );

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
    [saveKey],
  );

  const value = useMemo<NewKeyContextValue>(
    () => ({
      storedKey,
      isProcessing,
      error,
      generateKey,
      loadKey,
      saveKey,
    }),
    [storedKey, isProcessing, error, generateKey, loadKey, saveKey],
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
