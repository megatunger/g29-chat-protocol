import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  setEncryptedKey: (key: PersistedEncryptedKey | null) => void;
  setDecryptedPrivateKey: (value: string | null) => void;
  setLoggedIn: (value: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      encryptedKey: null,
      decryptedPrivateKey: null,
      isLoggedIn: false,
      setEncryptedKey: (key) => set({ encryptedKey: key }),
      setDecryptedPrivateKey: (value) => set({ decryptedPrivateKey: value }),
      setLoggedIn: (value) => set({ isLoggedIn: value }),
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
      }),
    },
  ),
);
