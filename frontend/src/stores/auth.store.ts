import { ChatKeyPair } from "@/lib/crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthState = {
  userKey: ChatKeyPair | null;
  isLoggedIn: boolean;
  setUserKey: (key: ChatKeyPair) => void;
  clearUserKey: () => void;
  setLoggedIn: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userKey: null,
      isLoggedIn: false,
      setUserKey: (keys) => set({ userKey: keys }),
      clearUserKey: () => set({ userKey: null }),
      setLoggedIn: (value) => set({ isLoggedIn: value }),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
