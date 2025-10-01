"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
} from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { buildEndpoint } from "@/constants/endpoint";
import ConnectingProgress from "@/components/common/ConnectingProgress";
import { useNewKey } from "@/contexts/NewKeyContext";
import { useServerStore } from "@/stores/server.store";

type WebSocketControls = ReturnType<typeof useWebSocket>;

type OutgoingMessage = {
  payload?: unknown;
  [key: string]: unknown;
};

export type NetworkContextValue = Pick<
  WebSocketControls,
  | "lastMessage"
  | "lastJsonMessage"
  | "readyState"
  | "sendMessage"
  | "sendJsonMessage"
  | "getWebSocket"
> & {
  serverUUID: string;
  serverHost: string;
  disconnect: () => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const CLIENT_HEARTBEAT_ID = "G29_CLIENT";

const NetworkProvider = ({ children }: PropsWithChildren) => {
  const serverHost = useServerStore((state) => state.serverHost);
  const serverUUID = "G29_SERVER";
  const { storedKey, sign } = useNewKey();
  const heartbeatSender = storedKey?.keyId ?? CLIENT_HEARTBEAT_ID;
  const heartbeatMessage = useCallback(
    () =>
      JSON.stringify({
        type: "HEARTBEAT",
        from: heartbeatSender,
        to: serverUUID,
        ts: Date.now(),
        payload: {},
        sig: "",
      }),
    [heartbeatSender, serverUUID],
  );
  const endpoint = useMemo(() => buildEndpoint(serverHost), [serverHost]);

  const {
    lastMessage,
    lastJsonMessage,
    readyState,
    sendMessage,
    sendJsonMessage,
    getWebSocket,
  } = useWebSocket(endpoint, {
    share: true,
    reconnectAttempts: 3,
    reconnectInterval: 3000,
    shouldReconnect: () => true,
    heartbeat: {
      interval: HEARTBEAT_INTERVAL_MS,
      timeout: HEARTBEAT_TIMEOUT_MS,
      message: heartbeatMessage,
    },
  });

  const disconnect = useCallback(() => {
    const socket = getWebSocket();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "client disconnect");
    }
  }, [getWebSocket]);

  const wrappedSendJsonMessage = useCallback(
    async (data: OutgoingMessage) => {
      let sig = "";
      if (!!storedKey) {
        sig = await sign(data?.payload);
      }

      sendJsonMessage({
        ...data,
        ts: new Date().getTime(),
        sig: sig,
      });
    },
    [sendJsonMessage, sign, storedKey],
  );

  const value = useMemo<NetworkContextValue>(
    () => ({
      serverUUID,
      lastMessage,
      lastJsonMessage,
      readyState,
      sendMessage,
      serverHost,
      sendJsonMessage: wrappedSendJsonMessage,
      getWebSocket,
      disconnect,
    }),
    [
      disconnect,
      getWebSocket,
      lastJsonMessage,
      lastMessage,
      readyState,
      wrappedSendJsonMessage,
      sendMessage,
      serverHost,
    ],
  );

  return (
    <NetworkContext.Provider value={value}>
      {readyState === ReadyState.OPEN ? (
        <>{children}</>
      ) : (
        <ConnectingProgress readyState={readyState} />
      )}
    </NetworkContext.Provider>
  );
};

const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};

export { NetworkProvider, useNetwork };
