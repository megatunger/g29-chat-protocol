import { ChatKeyPair } from "@/lib/crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthState = {
  userKey: ChatKeyPair | null;
  isLoggedIn: boolean;
  setUserKey: (key: ChatKeyPair) => void;
  setLoggedIn: (value: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userKey: null,
      isLoggedIn: false,
      setUserKey: (keys) => set({ userKey: keys }),
      setLoggedIn: (value) => set({ isLoggedIn: value }),
      logout: () => set({ isLoggedIn: false, userKey: null }),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
