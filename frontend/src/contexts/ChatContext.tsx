"use client";

import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useNetwork } from "@/contexts/NetworkContext";
import useList from "@/services/useList";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "date-fns";

type ChatDirection = "incoming" | "outgoing";

export type ChatMessage = {
  id: string;
  content: ReactNode;
  direction: ChatDirection;
  timestamp: number;
};

type ChatContextValue = {
  sendMessage: (message: string, keep?: boolean) => boolean;
  messages: ChatMessage[];
};

const ChatContext = createContext<ChatContextValue | null>(null);

const ChatProvider = ({ children }: PropsWithChildren) => {
  const { sendJsonMessage, serverUUID } = useNetwork();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { userKey } = useAuthStore(); // Get current user info
  const { mutateAsync: sendListAllUsers } = useList();

  const appendMessage = useCallback(
    (direction: ChatDirection, content: ReactNode, ts: number) => {
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
          content: content,
          direction,
          timestamp: ts,
        },
      ]);
    },
    [],
  );

  const sendMessageWithHistory = useCallback<ChatContextValue["sendMessage"]>(
    async (message, keep) => {
      const trimmed = message?.toString().trim();
      if (!trimmed || !userKey) {
        return false;
      }

      try {
        if (trimmed.startsWith("/list")) {
          appendMessage("outgoing", trimmed, new Date().getTime());
          const usersResponse = await sendListAllUsers({});
          appendMessage(
            "incoming",
            <div className="d-flex flex-row items-start">
              {usersResponse?.payload?.message}
              <br />
              <div className="mt-2 flex-col">
                {usersResponse?.payload?.users?.map((user) => (
                  <div key={user?.userID} className="mt-2">
                    <Badge className="cursor-pointer mr-2">
                      {user?.userID}
                    </Badge>
                    <span className="text-gray-500 text-xs">
                      {formatDistance(new Date(user?.ts), new Date(), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>,
            usersResponse?.ts,
          );
          return;
        }

        appendMessage("outgoing", trimmed, new Date().getTime());
        return true;
      } catch (error) {
        console.error("Failed to send message:", error);
        return false;
      }
    },
    [appendMessage, sendJsonMessage],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      sendMessage: sendMessageWithHistory,
      messages: messages,
    }),
    [messages, sendMessageWithHistory],
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
