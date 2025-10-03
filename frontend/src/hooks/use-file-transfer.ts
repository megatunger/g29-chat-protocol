"use client";

import { useCallback } from "react";
import { encode as encodeBase64Url } from "base64url-universal";

import { useNetwork } from "@/contexts/NetworkContext";
import { getFileForBlobUrl } from "@/lib/file-blob-registry";

const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64 KiB per chunk
const DEFAULT_TRANSFER_MODE = "dm";

const toHex = (buffer: ArrayBuffer): string => {
  const view = new Uint8Array(buffer);
  let hex = "";
  for (let index = 0; index < view.length; index += 1) {
    const byte = view[index];
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

const createFileId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

type FileTransferMode = "dm" | "public";

type SendFileTransferOptions = {
  senderId: string;
  recipientId: string;
  recipientPublicKey: string;
  fileUrl: string;
  mode?: FileTransferMode;
};

type FileTransferResult = {
  fileId: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  chunkCount: number;
};

const useFileTransfer = () => {
  const { sendJsonMessage } = useNetwork();

  const sendFile = useCallback(
    async ({
      senderId,
      recipientId,
      recipientPublicKey,
      fileUrl,
      mode = DEFAULT_TRANSFER_MODE,
    }: SendFileTransferOptions): Promise<FileTransferResult> => {
      if (!senderId) {
        throw new Error("Sender identifier is required for file transfer");
      }

      if (!recipientId) {
        throw new Error("Recipient identifier is required for file transfer");
      }

      if (!recipientPublicKey) {
        throw new Error("Recipient public key is required for file transfer");
      }

      const file = getFileForBlobUrl(fileUrl);
      if (!file) {
        throw new Error("Selected file is no longer available. Please re-select it.");
      }

      const fileId = createFileId();
      const fileBuffer = await file.arrayBuffer();
      const shaDigest = await crypto.subtle.digest("SHA-256", fileBuffer);
      const sha256 = toHex(shaDigest);

      await sendJsonMessage({
        type: "FILE_START",
        from: senderId,
        to: recipientId,
        payload: {
          file_id: fileId,
          name: file.name,
          size: file.size,
          sha256,
          mode,
        },
      });

      let chunkCount = 0;
      for (
        let offset = 0;
        offset < fileBuffer.byteLength;
        offset += DEFAULT_CHUNK_SIZE
      ) {
        const remaining = fileBuffer.byteLength - offset;
        const chunkLength = Math.min(DEFAULT_CHUNK_SIZE, remaining);
        const chunkView = new Uint8Array(fileBuffer, offset, chunkLength);
        const ciphertext = encodeBase64Url(chunkView);

        await sendJsonMessage({
          type: "FILE_CHUNK",
          from: senderId,
          to: recipientId,
          payload: {
            file_id: fileId,
            index: chunkCount,
            ciphertext,
          },
        });

        chunkCount += 1;
      }

      await sendJsonMessage({
        type: "FILE_END",
        from: senderId,
        to: recipientId,
        payload: {
          file_id: fileId,
        },
      });

      return {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        sha256,
        chunkCount,
      };
    },
    [sendJsonMessage],
  );

  return { sendFile };
};

export type { FileTransferResult, FileTransferMode, SendFileTransferOptions };
export default useFileTransfer;
