"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import useProtocolRequest from "@/services/useProtocolRequest";
import { useSendAndExpectOptions } from "@/services/constants";
import { useMutation } from "@tanstack/react-query";
import { useNewKey } from "@/contexts/NewKeyContext";

export type useListResponse = {
  type: string;
  from: string;
  to: string;
  payload: {
    users: Array<{
      userID: string;
      version: string;
      ts: string;
      pubkey: string;
    }>;
    total: number;
    message: string;
  };
  ts: number;
};

function useList() {
  const { serverUUID } = useNetwork();
  const { sendAndExpect } = useProtocolRequest();
  const { storedKey } = useNewKey();

  return useMutation<
    useListResponse,
    unknown,
    {
      options?: useSendAndExpectOptions;
    }
  >({
    mutationFn: async ({ options }): Promise<void> => {
      const { expectedType = "USER_LIST", timeoutMs, validate } = options ?? {};
      const validator =
        typeof validate === "function"
          ? validate
          : (message: unknown): boolean => {
              if (!message || typeof message !== "object") {
                return false;
              }

              const typed = message as Record<string, unknown>;
              const responseType = typed.type;
              return responseType === expectedType;
            };

      return sendAndExpect<void>(
        {
          type: "LIST",
          from: storedKey?.keyId,
          to: serverUUID,
          payload: {},
          sig: "",
        },
        validator,
        {
          timeoutMs,
          mismatchMessage: `Unexpected response to LIST (expected ${expectedType})`,
          failOnMismatch: true,
        },
      );
    },
  });
}

export default useList;
