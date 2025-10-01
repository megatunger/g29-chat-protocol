import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_SERVER_HOST } from "@/constants/endpoint";

export type PersistedEncryptedKey = {
  publicKey: string;
  encryptedPrivateKey: string;
  keyId: string;
  salt: string;
  iv: string;
  version: number;
  encryptedPassword: string | null;
};

type AuthState = {
  encryptedKey: PersistedEncryptedKey | null;
  decryptedPrivateKey: string | null;
  isLoggedIn: boolean;
  serverHost: string;
  setEncryptedKey: (key: PersistedEncryptedKey | null) => void;
  setDecryptedPrivateKey: (value: string | null) => void;
  setLoggedIn: (value: boolean) => void;
  setServerHost: (value: string) => void;
  logout: () => void;
};

const sanitizeServerHost = (value?: string): string => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return DEFAULT_SERVER_HOST;
  }

  return trimmed.replace(/\/+$/, "");
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      encryptedKey: null,
      decryptedPrivateKey: null,
      isLoggedIn: false,
      serverHost: DEFAULT_SERVER_HOST,
      setEncryptedKey: (key) => set({ encryptedKey: key }),
      setDecryptedPrivateKey: (value) => set({ decryptedPrivateKey: value }),
      setLoggedIn: (value) => set({ isLoggedIn: value }),
      setServerHost: (value) =>
        set({
          serverHost: sanitizeServerHost(value),
        }),
      logout: () =>
        set({
          encryptedKey: null,
          decryptedPrivateKey: null,
          isLoggedIn: false,
        }),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        encryptedKey: state.encryptedKey,
        serverHost: state.serverHost,
      }),
    },
  ),
);
