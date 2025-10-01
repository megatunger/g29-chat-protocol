import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_SERVER_HOST } from "@/constants/endpoint";

type ServerState = {
  serverHost: string;
  setServerHost: (host: string) => void;
};

export const useServerStore = create<ServerState>()(
  persist(
    (set) => ({
      serverHost: DEFAULT_SERVER_HOST,
      setServerHost: (host) =>
        set({
          serverHost: host?.trim() || DEFAULT_SERVER_HOST,
        }),
    }),
    {
      name: "server",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

