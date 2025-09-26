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
import useWebSocket, { ReadyState } from "react-use-websocket";

import { endpoint } from "@/constants/endpoint";
import { useAuthStore } from "@/stores/auth.store";

type ChatDirection = "incoming" | "outgoing";

export type ChatMessage = {
  id: string;
  content: string;
  direction: ChatDirection;
  timestamp: number;
};

type ChatContextValue = {
  lastMessage: MessageEvent<any> | null;
  readyState: ReadyState;
  sendMessage: (message: string, keep?: boolean) => boolean;
  messages: ChatMessage[];
};

const ChatContext = createContext<ChatContextValue | null>(null);

const ChatProvider = ({ children }: PropsWithChildren) => {
  const { lastMessage, readyState, sendJsonMessage } = useWebSocket(endpoint, {
    // heartbeat: {
    //   interval: 5000,
    // },
    reconnectAttempts: 3,
    reconnectInterval: 3000,
    shouldReconnect: () => true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { userKey } = useAuthStore(); // Get current user info

  const appendMessage = useCallback(
    (direction: ChatDirection, content: string) => {
      const trimmed = content?.toString().trim();
      if (!trimmed) {
        return;
      }

      const createId = () => {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
          return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      };

      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          content: trimmed,
          direction,
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  const sendMessageWithHistory = useCallback<ChatContextValue["sendMessage"]>(
    (message, keep) => {
      const trimmed = message?.toString().trim();
      if (!trimmed) {
        return false;
      }

      try {
        
        if (trimmed.startsWith('/list')) {
          sendJsonMessage(
            {
              type: "LIST",
              from: userKey?.keyId || "anonymous",
              to: "server",
              payload: {},
            },
            keep,
          );
        }
        
        appendMessage("outgoing", trimmed);
        return true;
      } catch (error) {
        console.error("Failed to send message:", error);
        return false;
      }
    },
    [appendMessage, sendJsonMessage],
  );

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    const data =
      typeof lastMessage.data === "string"
        ? lastMessage.data
        : (() => {
            try {
              return JSON.stringify(lastMessage.data);
            } catch (error) {
              return "[unsupported payload]";
            }
          })();

    appendMessage("incoming", data);
  }, [appendMessage, lastMessage]);

  const value = useMemo<ChatContextValue>(
    () => ({
      lastMessage,
      readyState,
      sendMessage: sendMessageWithHistory,
      messages,
    }),
    [lastMessage, messages, readyState, sendMessageWithHistory],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export { ChatProvider, useChat };
