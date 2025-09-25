"use client";

import {createContext, PropsWithChildren, useCallback, useContext, useMemo,} from "react";
import useWebSocket from "react-use-websocket";

import {endpoint} from "@/constants/endpoint";

type WebSocketControls = ReturnType<typeof useWebSocket>;

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
  disconnect: () => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

const NetworkProvider = ({ children }: PropsWithChildren) => {
  const serverUUID = "G29";
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
  });

  const disconnect = useCallback(() => {
    const socket = getWebSocket();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "client disconnect");
    }
  }, [getWebSocket]);

  const wrappedSendJsonMessage = useCallback(
    (data: any) => {
      sendJsonMessage({
        ...data,
        ts: new Date().getTime(),
      });
    },
    [sendJsonMessage],
  );

  const value = useMemo<NetworkContextValue>(
    () => ({
      serverUUID,
      lastMessage,
      lastJsonMessage,
      readyState,
      sendMessage,
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
    ],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
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
