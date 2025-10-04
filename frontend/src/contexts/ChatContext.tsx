"use client";

import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { decode as decodeBase64Url } from "base64url-universal";
import { useAuthStore } from "@/stores/auth.store";
import { useNetwork } from "@/contexts/NetworkContext";
import useList from "@/services/useList";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "date-fns";
import useProtocolRequest from "@/services/useProtocolRequest";
import { useNewKey } from "@/contexts/NewKeyContext";
import useChatTransforms from "@/hooks/use-chat-transforms";
import useFileTransfer from "@/hooks/use-file-transfer";
import { publicChannelKeyManager } from "@/lib/group-keys";
import UserListContainer from "@/components/ui/UserListContainer";
import UserList from "@/components/ui/UserList";

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

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return `${bytes}`;
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0,
    maximumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0,
  });

  return `${formatter.format(value)} ${units[unitIndex]}`;
};

const ChatProvider = ({ children }: PropsWithChildren) => {
  const { serverUUID, lastJsonMessage } = useNetwork();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const activeFileTransfersRef = useRef<
    Map<
      string,
      {
        senderId: string;
        fileName: string;
        fileSize: number;
        sha256: string;
        mode: string;
        chunks: Uint8Array[];
        receivedBytes: number;
        receivedChunks: number;
        startedAt: number;
      }
    >
  >(new Map());
  const hasEncryptedKey = useAuthStore((state) => !!state.encryptedKey);
  const { mutateAsync: sendListAllUsers } = useList();
  const { sendAndExpect } = useProtocolRequest();
  const { storedKey } = useNewKey();
  const { createDirectMessagePayload, decryptDirectMessagePayload } =
    useChatTransforms();
  const { sendFile } = useFileTransfer();

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
      if (!trimmed || !hasEncryptedKey || !storedKey) {
        return false;
      }

      try {
        if (trimmed.startsWith("/list")) {
          appendMessage("outgoing", trimmed, new Date().getTime());
          const usersResponse = await sendListAllUsers({});
          // render interactive UserList component inside the incoming message
          appendMessage(
            "incoming",
            <div>
              <div className="mb-2">{usersResponse?.payload?.message}</div>
              <UserList users={usersResponse?.payload?.users || []} />
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
              recipientPublicKey: recipient.pubkey ?? "",
              senderPrivateKey: storedKey.privateKey ?? "",
            });

            const response = await sendAndExpect(
              {
                type: "MSG_DIRECT",
                from: storedKey.keyId,
                to: serverUUID,
                recipient: recipientId,
                payload: {
                  sender_pub: storedKey.publicKey,
                  ciphertext: directMessage.ciphertext,
                  // content_sig signs the ciphertext bytes so recipients can verify before decrypting
                  content_sig: directMessage.contentSignature,
                },
              },
              (message) => {
                if (!message || typeof message !== "object") {
                  return false;
                }

                const typed = message as {
                  type?: string;
                  payload?: {
                    recipient?: string | null;
                    recipientId?: string | null;
                    content_sig?: string | null;
                  };
                };

                if (typed.type !== "MSG_DIRECT_ACK") {
                  return false;
                }

                const ackRecipient =
                  typed.payload?.recipient ?? typed.payload?.recipientId;
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
              <span className="text-red-500">Usage: /all &lt;message&gt;</span>,
              Date.now(),
            );
            return false;
          }

          try {
            // Create group key encrypted public message (SOCP compliant)
            const timestamp = Date.now();

            const encryptedPayload =
              await publicChannelKeyManager.createPublicChannelMessage(
                messageContent,
                storedKey.keyId,
                storedKey.privateKey ?? "",
                storedKey.publicKey,
                "public",
              );

            const response = await sendAndExpect(
              {
                type: "MSG_PUBLIC_CHANNEL",
                from: storedKey.keyId,
                to: "public",
                ts: timestamp,
                payload: {
                  ciphertext: encryptedPayload.ciphertext,
                  content_sig: encryptedPayload.content_sig,
                  sender_pub: encryptedPayload.sender_pub,
                  timestamp: timestamp,
                },
              },
              (message) => {
                const typed = message as any;
                return typed?.type === "MSG_PUBLIC_CHANNEL_ACK";
              },
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

        if (trimmed.startsWith("/file ")) {
          appendMessage("outgoing", trimmed, new Date().getTime());

          const match = trimmed.match(/^\/file\s+(\S+)\s+(\S+)$/);

          if (!match) {
            appendMessage(
              "incoming",
              <span className="text-red-500">
                Usage: /file &lt;user&gt; &lt;blob-url&gt;
              </span>,
              Date.now(),
            );
            return false;
          }

          const [, rawRecipientId, blobUrl] = match;
          const isPublicFileTransfer = rawRecipientId === "all";
          const recipientId = isPublicFileTransfer ? "public" : rawRecipientId;

          try {
            let recipientPublicKey: string | undefined;

            if (!isPublicFileTransfer) {
              const listResponse = await sendListAllUsers({});
              const users = Array.isArray(listResponse?.payload?.users)
                ? listResponse.payload.users
                : [];

              const recipient = users.find(
                (user) => user?.userID === rawRecipientId,
              );

              if (!recipient) {
                appendMessage(
                  "incoming",
                  <span className="text-red-500">
                    User <strong>{rawRecipientId}</strong> was not found. Use
                    /list to see online users.
                  </span>,
                  Date.now(),
                );
                return false;
              }

              if (typeof recipient?.pubkey !== "string" || !recipient.pubkey) {
                appendMessage(
                  "incoming",
                  <span className="text-red-500">
                    Missing public key for <strong>{rawRecipientId}</strong>.
                    Unable to initiate file transfer.
                  </span>,
                  Date.now(),
                );
                return false;
              }

              recipientPublicKey = recipient.pubkey;
            }

            const result = await sendFile({
              senderId: storedKey.keyId,
              recipientId,
              recipientPublicKey,
              fileUrl: blobUrl,
              mode: isPublicFileTransfer ? "public" : "dm",
            });

            appendMessage(
              "incoming",
              <span className="text-emerald-600">
                Sent <strong>{result.fileName}</strong> (
                {formatFileSize(result.fileSize)}) to{" "}
                <strong>
                  {isPublicFileTransfer ? "public channel" : rawRecipientId}
                </strong>{" "}
                in {result.chunkCount} chunk
                {result.chunkCount === 1 ? "" : "s"}.
              </span>,
              Date.now(),
            );

            return true;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Failed to send file";
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
      hasEncryptedKey,
      sendFile,
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

    if (
      message?.type !== "USER_DELIVER" &&
      message?.type !== "MSG_PUBLIC_CHANNEL_DELIVERY" &&
      message?.type !== "PUBLIC_CHANNEL_KEY_DELIVERY"
    ) {
      return;
    }

    // Handle public channel key delivery (SOCP compliance) - silent
    if (message.type === "PUBLIC_CHANNEL_KEY_DELIVERY") {
      // Store and unwrap the group key
      const payload = message.payload as any;
      if (
        payload?.wrapped_key &&
        payload?.channel_id &&
        payload?.version &&
        storedKey?.privateKey
      ) {
        try {
          publicChannelKeyManager.storeWrappedGroupKey(
            payload.channel_id,
            payload.wrapped_key,
            payload.version,
          );

          // Unwrap the group key so it's ready for encryption/decryption
          publicChannelKeyManager
            .unwrapAndStoreGroupKey(
              payload.channel_id,
              payload.wrapped_key,
              storedKey.privateKey,
            )
            .catch((error) => {
              console.error("Failed to unwrap group key:", error);
            });
        } catch (error) {
          console.error("Failed to process group key:", error);
        }
      }
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

    const timestamp =
      typeof payload.timestamp === "number" ? payload.timestamp : Date.now();

    const isPublicMessage = message.type === "MSG_PUBLIC_CHANNEL_DELIVERY";

    // SOCP compliance: Only handle encrypted messages
    if (!ciphertext || !currentKey?.privateKey) {
      return;
    }

    const displayMessage = async () => {
      try {
        let plaintext: string;
        let contentSignatureValid: boolean;

        if (isPublicMessage) {
          // Check if we have a group key for decryption
          let hasGroupKey =
            publicChannelKeyManager.getGroupKey("public") !== null;

          // If no group key exists, generate one for testing (temporary solution)
          if (!hasGroupKey) {
            console.log(
              "No group key found, generating deterministic key for testing",
            );
            await publicChannelKeyManager.generateDeterministicGroupKey(
              "public",
            );
            hasGroupKey = true;
            console.log("Generated deterministic group key for public channel");
          } else {
            console.log("Using existing group key for decryption");
          }

          // Handle public channel message decryption using group key manager
          const decrypted =
            await publicChannelKeyManager.decryptPublicChannelMessage(
              ciphertext,
              contentSignature || "",
              senderPublicKey,
              sender,
              timestamp,
            );
          plaintext = decrypted.message;
          contentSignatureValid = decrypted.contentSignatureValid;
        } else {
          // Handle direct message decryption
          const result = await decryptDirectMessagePayload({
            ciphertext,
            senderPublicKey,
            recipientPrivateKey: currentKey.privateKey,
            contentSignature,
          });
          plaintext = result.message;
          contentSignatureValid = result.contentSignatureValid;
        }

        appendMessage(
          "incoming",
          <div>
            <div className="font-semibold text-sm text-slate-800">
              {isPublicMessage ? (
                <span className="text-blue-600">📢 Public: {sender}</span>
              ) : (
                `Direct message from ${sender}`
              )}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-slate-900">
              {plaintext}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Ciphertext signature:{" "}
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
        const messageType = isPublicMessage ? "public" : "direct";

        console.error(`Failed to decrypt ${messageType} message:`, error);

        if (isPublicMessage) {
          // For public messages, show the actual error
          appendMessage(
            "incoming",
            <div>
              <div className="font-semibold text-sm text-blue-600">
                📢 Public: {sender}
              </div>
              <div className="mt-1 text-red-600">
                [Decryption failed: {reason}]
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Error details: {reason}
              </div>
            </div>,
            timestamp,
          );
        } else {
          appendMessage(
            "incoming",
            <span className="text-red-500">
              Failed to decrypt {messageType} message from{" "}
              <strong>{sender}</strong>: {reason}
            </span>,
            timestamp,
          );
        }
      }
    };

    void displayMessage();
  }, [appendMessage, decryptDirectMessagePayload, lastJsonMessage, storedKey]);

  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }

    const message = lastJsonMessage as {
      type?: string;
      from?: string;
      payload?: Record<string, unknown> | null;
    };

    if (!message?.type || !message.payload) {
      return;
    }

    if (message.type === "FILE_START") {
      const fileId =
        typeof message.payload.file_id === "string"
          ? message.payload.file_id
          : null;

      if (!fileId) {
        return;
      }

      if (!activeFileTransfersRef.current.has(fileId)) {
        const senderId =
          typeof message.from === "string" ? message.from : "unknown";
        const fileName =
          typeof message.payload.name === "string"
            ? message.payload.name
            : "unknown";
        const fileSize =
          typeof message.payload.size === "number" ? message.payload.size : 0;
        const sha256 =
          typeof message.payload.sha256 === "string"
            ? message.payload.sha256
            : "";
        const mode =
          typeof message.payload.mode === "string"
            ? message.payload.mode
            : "dm";

        activeFileTransfersRef.current.set(fileId, {
          senderId,
          fileName,
          fileSize,
          sha256,
          mode,
          chunks: [],
          receivedBytes: 0,
          receivedChunks: 0,
          startedAt: Date.now(),
        });
      }

      return;
    }

    if (message.type === "FILE_CHUNK") {
      const fileId =
        typeof message.payload.file_id === "string"
          ? message.payload.file_id
          : null;
      const chunkIndex =
        typeof message.payload.index === "number"
          ? message.payload.index
          : null;
      const ciphertext =
        typeof message.payload.ciphertext === "string"
          ? message.payload.ciphertext
          : null;

      if (!fileId || chunkIndex === null || chunkIndex < 0 || !ciphertext) {
        return;
      }

      const transfer = activeFileTransfersRef.current.get(fileId);

      if (!transfer) {
        return;
      }

      try {
        const chunkData = decodeBase64Url(ciphertext);
        const previousChunk = transfer.chunks[chunkIndex];
        transfer.chunks[chunkIndex] = chunkData;

        if (previousChunk instanceof Uint8Array) {
          transfer.receivedBytes += chunkData.length - previousChunk.length;
        } else {
          transfer.receivedBytes += chunkData.length;
          transfer.receivedChunks += 1;
        }
      } catch (error) {
        console.error("Failed to decode FILE_CHUNK payload", error);
      }

      return;
    }

    if (message.type === "FILE_END") {
      const fileId =
        typeof message.payload.file_id === "string"
          ? message.payload.file_id
          : null;

      if (!fileId) {
        return;
      }

      const transfer = activeFileTransfersRef.current.get(fileId);

      if (!transfer) {
        return;
      }

      if (typeof message.payload.name === "string") {
        transfer.fileName = message.payload.name;
      }

      if (typeof message.payload.size === "number") {
        transfer.fileSize = message.payload.size;
      }

      if (typeof message.payload.sha256 === "string") {
        transfer.sha256 = message.payload.sha256;
      }

      if (typeof message.payload.mode === "string") {
        transfer.mode = message.payload.mode;
      }

      if (typeof message.payload.chunks === "number") {
        transfer.receivedChunks = Math.max(
          transfer.receivedChunks,
          message.payload.chunks,
        );
      }

      activeFileTransfersRef.current.delete(fileId);

      const blobParts = transfer.chunks.filter(
        (chunk): chunk is Uint8Array => chunk instanceof Uint8Array,
      );
      const blob = new Blob(blobParts, {
        type: "application/octet-stream",
      });
      const downloadUrl = URL.createObjectURL(blob);

      appendMessage(
        "incoming",
        <div>
          <div className="font-semibold text-sm text-slate-800">
            📁 File from {transfer.senderId}
          </div>
          <div className="mt-1 text-slate-900">
            <a
              className="text-blue-600 underline"
              href={downloadUrl}
              download={transfer.fileName}
            >
              Download {transfer.fileName}
            </a>{" "}
            ({formatFileSize(transfer.fileSize)})
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Received {transfer.receivedChunks} chunk
            {transfer.receivedChunks === 1 ? "" : "s"} totaling{" "}
            {formatFileSize(transfer.receivedBytes)}.
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Mode: {transfer.mode === "public" ? "public broadcast" : "direct"}
          </div>
          {transfer.sha256 ? (
            <div className="mt-1 text-[11px] text-slate-500">
              SHA-256:{" "}
              <code className="font-mono break-all">{transfer.sha256}</code>
            </div>
          ) : null}
        </div>,
        Date.now(),
      );

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 60_000);

      return;
    }
  }, [appendMessage, lastJsonMessage]);

  const value = useMemo<ChatContextValue>(
    () => ({
      sendMessage: sendMessageWithHistory,
      messages: messages,
    }),
    [messages, sendMessageWithHistory],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export { ChatProvider, useChat };
