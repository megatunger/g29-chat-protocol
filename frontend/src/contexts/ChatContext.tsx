"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { endpoint } from "@/constants/endpoint";
import { useKeys } from "@/contexts/KeyContext";

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
  canSendMessages: boolean;
  messages: ChatMessage[];
  isAuthenticated: boolean;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const ChatProvider = ({ children }: PropsWithChildren) => {
  const { hasKeys, getPublicKey } = useKeys();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const { lastMessage, readyState, sendJsonMessage } = useWebSocket(endpoint, {
    // heartbeat: {
    //   interval: 5000,
    // },
    reconnectAttempts: 3,
    reconnectInterval: 3000,
    shouldReconnect: () => true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Automatically send USER_HELLO when keys are available and session is valid
  useEffect(() => {
    const publicKey = getPublicKey();
    const userId = sessionStorage.getItem('userID');
    
    if (publicKey && userId && hasKeys && readyState === ReadyState.OPEN) {
      const sessionToken = sessionStorage.getItem('sessionToken');
      const challenge = sessionStorage.getItem('challenge');
      
      if (!sessionToken || !challenge) {
        console.error('Missing session data for USER_HELLO');
        return;
      }

      const userHelloMessage = {
        type: 'USER_HELLO',
        data: {
          userId: userId,
          publicKey: publicKey,
          sessionToken: sessionToken,
          challenge: challenge
        }
      };

      sendJsonMessage(userHelloMessage);
      setIsAuthenticated(true);
    }
  }, [hasKeys, getPublicKey, readyState, sendJsonMessage]);

  // Reset authentication when connection is lost
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) {
      setIsAuthenticated(false);
    }
  }, [readyState]);

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
        sendJsonMessage(
          {
            message: message,
          },
          keep,
        );
        appendMessage("outgoing", trimmed);
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
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
      canSendMessages: readyState === ReadyState.OPEN && isAuthenticated,
      messages,
      isAuthenticated,
    }),
    [lastMessage, messages, readyState, sendMessageWithHistory, isAuthenticated],
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
