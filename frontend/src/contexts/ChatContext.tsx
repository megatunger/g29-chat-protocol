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
import useChatTransforms from "@/hooks/use-chat-transforms";

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
  const { createDirectMessagePayload, decryptDirectMessagePayload } =
    useChatTransforms();

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
                  <div
                    key={user?.userID}
                    className="mt-2 flex-row flex items-center"
                  >
                    <Badge className="mr-2">{user?.userID}</Badge>
                    <div className="text-gray-500 text-xs">
                      {formatDistance(new Date(user?.ts), new Date(), {
                        addSuffix: true,
                      })}
                    </div>
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

          try {
            const listResponse = await sendListAllUsers({});
            const users = Array.isArray(listResponse?.payload?.users)
              ? listResponse.payload.users
              : [];

            const recipient = users.find(
              (user) => user?.userID === recipientId,
            );

            if (!recipient) {
              appendMessage(
                "incoming",
                <span className="text-red-500">
                  User <strong>{recipientId}</strong> was not found. Use /list
                  to see online users.
                </span>,
                Date.now(),
              );
              return false;
            }

            const directMessage = await createDirectMessagePayload({
              message: body,
              senderId: storedKey.keyId,
              recipientId,
              recipientPublicKey: recipient.pubkey ?? "",
              senderPrivateKey: storedKey.privateKey ?? "",
            });

            const response = await sendAndExpect(
              {
                type: "MSG_DIRECT",
                from: storedKey.keyId,
                to: serverUUID,
                payload: {
                  recipientId,
                  sender_pub: storedKey.publicKey,
                  ciphertext: directMessage.envelope,
                  content_sig: directMessage.contentSignature,
                  timestamp: directMessage.timestamp,
                },
              },
              (message) => {
                if (!message || typeof message !== "object") {
                  return false;
                }

                const typed = message as {
                  type?: string;
                  payload?: {
                    recipientId?: string | null;
                    content_sig?: string | null;
                  };
                };

                if (typed.type !== "MSG_DIRECT_ACK") {
                  return false;
                }

                const ackRecipient = typed.payload?.recipientId;
                const ackSignature = typed.payload?.content_sig;

                return (
                  (typeof ackRecipient !== "string" ||
                    ackRecipient === recipientId) &&
                  (typeof ackSignature !== "string" ||
                    ackSignature === directMessage.contentSignature)
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

        if (trimmed.startsWith("/all ")) {
          appendMessage("outgoing", trimmed, new Date().getTime());

          const messageContent = trimmed.substring(5); // Remove '/all '
          
          if (!messageContent.trim()) {
            appendMessage(
              "incoming",
              <span className="text-red-500">
                Usage: /all &lt;message&gt;
              </span>,
              Date.now(),
            );
            return false;
          }

          try {
            // Create encrypted message for public channel
            const publicChannelMessage = await createDirectMessagePayload({
              message: messageContent,
              senderId: storedKey.keyId,
              recipientId: "public",
              recipientPublicKey: storedKey.publicKey ?? "",
              senderPrivateKey: storedKey.privateKey ?? "",
            });

            const response = await sendAndExpect(
              {
                type: "MSG_PUBLIC_CHANNEL",
                from: storedKey.keyId,
                to: serverUUID,
                payload: {
                  sender_pub: storedKey.publicKey,
                  ciphertext: publicChannelMessage.envelope,
                  content_sig: publicChannelMessage.contentSignature,
                  timestamp: publicChannelMessage.timestamp,
                },
              },
              (message) => {
                const typed = message as any;
                return typed?.type === "MSG_PUBLIC_CHANNEL_ACK";
              }
            );

            const recipients = (response as any)?.payload?.recipients || 0;
            appendMessage(
              "incoming",
              <span className="text-blue-600">
                Public message broadcast to <strong>{recipients}</strong> users.
              </span>,
              Date.now(),
            );

            return true;
          } catch (error) {
            console.error("Failed to send public message:", error);
            appendMessage(
              "incoming",
              <span className="text-red-500">
                Failed to send public message
              </span>,
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
    const ciphertext =
      typeof payload.ciphertext === "string" ? payload.ciphertext : "";
    const senderPublicKey =
      typeof payload.sender_pub === "string" ? payload.sender_pub : "";
    const sender =
      typeof payload.sender === "string"
        ? payload.sender
        : typeof message.from === "string"
          ? message.from
          : "unknown";
    const contentSignature =
      typeof payload.content_sig === "string" ? payload.content_sig : null;

    const currentKey = storedKey;

    if (!ciphertext || !currentKey?.privateKey) {
      return;
    }

    const timestamp =
      typeof payload.timestamp === "number" ? payload.timestamp : Date.now();

    const displayMessage = async () => {
      try {
        const {
          message: plaintext,
          plaintextSignatureValid,
          contentSignatureValid,
        } = await decryptDirectMessagePayload({
          envelope: ciphertext,
          sender,
          recipientId: currentKey.keyId,
          senderPublicKey,
          recipientPrivateKey: currentKey.privateKey,
          contentSignature,
          timestamp,
        });

        appendMessage(
          "incoming",
          <div>
            <div className="font-semibold text-sm text-slate-800">
              Direct message from {sender}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-slate-900">
              {plaintext}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Signature: {plaintextSignatureValid ? "valid" : "invalid"};
              Content signature:{" "}
              {contentSignature
                ? contentSignatureValid
                  ? "valid"
                  : "invalid"
                : "missing"}
            </div>
          </div>,
          timestamp,
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Failed to decrypt message";
        appendMessage(
          "incoming",
          <span className="text-red-500">
            Failed to decrypt direct message from <strong>{sender}</strong>:{" "}
            {reason}
          </span>,
          timestamp,
        );
      }
    };

    void displayMessage();
  }, [appendMessage, decryptDirectMessagePayload, lastJsonMessage, storedKey]);

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
