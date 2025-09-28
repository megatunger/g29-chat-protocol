"use client";

import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useNetwork } from "@/contexts/NetworkContext";
import useList from "@/services/useList";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "date-fns";
import useProtocolRequest from "@/services/useProtocolRequest";
import { useNewKey } from "@/contexts/NewKeyContext";

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
  const { serverUUID, lastJsonMessage } = useNetwork();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { userKey } = useAuthStore(); // Get current user info
  const { mutateAsync: sendListAllUsers } = useList();
  const { sendAndExpect } = useProtocolRequest();
  const { storedKey } = useNewKey();

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
      if (!trimmed || !userKey || !storedKey) {
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
          return true;
        }

        if (trimmed.startsWith("/tell")) {
          appendMessage("outgoing", trimmed, new Date().getTime());

          const match = trimmed.match(/^\/tell\s+(\S+)\s+(.+)$/);

          // TODO find the recipient in the user list, grab the user object
          if (!match) {
            appendMessage(
              "incoming",
              <span className="text-red-500">
                Usage: /tell &lt;user&gt; &lt;text&gt;
              </span>,
              Date.now(),
            );
            return false;
          }

          const [, recipientId, body] = match;
          const messageId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

          try {
            // TODO: Create a hooks for all transform function in hooks folder
            const response = await sendAndExpect(
              {
                type: "MSG_DIRECT",
                from: storedKey.keyId,
                to: serverUUID,
                payload: {
                  // TODO: remove message ID field
                  messageId,
                  // TODO: recipientId should be sender_pub, lookup from pubkey field in user object
                  recipientId,
                  // TODO: body field should be ciphertext field, it should be encrypted RSA-OAEP(SHA-256) using function encryptAndSign in crypto.js with recipient pubkey
                  body,
                  // TODO: field content_sig, using function signPayload in crypto.ts, the payload is created from  "ciphertext|from|to|ts"
                },
              },
              (message) => {
                if (!message || typeof message !== "object") {
                  return false;
                }

                const typed = message as {
                  type?: string;
                  payload?: { messageId?: string | null };
                };

                return (
                  typed.type === "MSG_DIRECT_ACK" &&
                  typed.payload?.messageId === messageId
                );
              },
              {
                timeoutMs: 7_500,
                mismatchMessage: "Unexpected response while sending MSG_DIRECT",
                failOnMismatch: false,
              },
            );

            const ackPayload =
              (response as { payload?: Record<string, unknown> }).payload || {};
            const ackRecipient =
              typeof ackPayload.recipientId === "string"
                ? ackPayload.recipientId
                : recipientId;
            const ackStatus =
              typeof ackPayload.status === "string"
                ? ackPayload.status
                : "unknown";

            let ackContent: ReactNode;
            if (ackStatus === "delivered") {
              ackContent = (
                <span className="text-emerald-600">
                  Direct message delivered to <strong>{ackRecipient}</strong>.
                </span>
              );
            } else if (ackStatus === "recipient_unavailable") {
              ackContent = (
                <span className="text-amber-600">
                  <strong>{ackRecipient}</strong> is not connected locally.
                  TODO: forward via server-to-server delivery.
                </span>
              );
            } else if (ackStatus === "delivery_failed") {
              const detail =
                typeof ackPayload.error === "string"
                  ? ackPayload.error
                  : "Delivery failed";
              ackContent = (
                <span className="text-red-500">
                  Failed to deliver direct message to{" "}
                  <strong>{ackRecipient}</strong>: {detail}
                </span>
              );
            } else {
              ackContent = (
                <span className="text-slate-500">
                  Direct message status for <strong>{ackRecipient}</strong>:{" "}
                  {ackStatus}
                </span>
              );
            }

            appendMessage(
              "incoming",
              ackContent,
              (response as { ts?: number }).ts ?? Date.now(),
            );
            return true;
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to send direct message";
            appendMessage(
              "incoming",
              <span className="text-red-500">{message}</span>,
              Date.now(),
            );
            return false;
          }
        }

        appendMessage("outgoing", trimmed, new Date().getTime());
        return true;
      } catch (error) {
        console.error("Failed to send message:", error);
        return false;
      }
    },
    [
      appendMessage,
      sendListAllUsers,
      sendAndExpect,
      serverUUID,
      storedKey,
      userKey,
    ],
  );

  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }

    const message = lastJsonMessage as {
      type?: string;
      from?: string;
      payload?: Record<string, unknown> | null;
    };

    if (message?.type !== "USER_DELIVER") {
      return;
    }

    const payload = message.payload || {};
    const body = typeof payload.body === "string" ? payload.body : "";
    const senderId =
      typeof payload.senderId === "string"
        ? payload.senderId
        : typeof message.from === "string"
          ? message.from
          : "unknown";

    if (!body) {
      return;
    }

    const timestamp =
      typeof payload.timestamp === "number" ? payload.timestamp : Date.now();

    appendMessage(
      "incoming",
      <div>
        <div className="font-semibold text-sm text-slate-800">
          Direct message from {senderId}
        </div>
        <div className="mt-1 whitespace-pre-wrap break-words text-slate-900">
          {body}
        </div>
      </div>,
      timestamp,
    );
  }, [appendMessage, lastJsonMessage]);

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
