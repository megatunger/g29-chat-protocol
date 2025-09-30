"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import useProtocolRequest from "@/services/useProtocolRequest";
import { clientVersion, DEFAULT_EXPECTED_TYPE } from "@/services/constants";
import { useMutation } from "@tanstack/react-query";

type UserHelloOptions = {
  expectedType?: string;
  timeoutMs?: number;
  validate?: (message: unknown) => boolean;
};

function useUserHello() {
  const { serverUUID } = useNetwork();
  const { sendAndExpect } = useProtocolRequest();

  return useMutation<
    unknown,
    unknown,
    {
      userID: string;
      pubkey: string;
      options?: UserHelloOptions;
    }
  >({
    mutationFn: async ({ userID, pubkey, options }): Promise<void> => {
      const {
        expectedType = DEFAULT_EXPECTED_TYPE,
        timeoutMs,
        validate,
      } = options ?? {};

      const validator =
        typeof validate === "function"
          ? validate
          : (message: unknown): boolean => {
              if (!message || typeof message !== "object") {
                return false;
              }

              const typed = message as Record<string, unknown>;
              const responseType = typed.type;
              return responseType === DEFAULT_EXPECTED_TYPE;
            };

      return sendAndExpect<void>(
        {
          type: "USER_HELLO",
          from: userID,
          to: serverUUID,
          payload: {
            client: clientVersion,
            pubkey,
            enc_pubkey: pubkey,
          },
          sig: "",
        },
        validator,
        {
          timeoutMs,
          mismatchMessage: `Unexpected response to USER_HELLO (expected ${expectedType})`,
          failOnMismatch: false,
        },
      );
    },
  });
}

export default useUserHello;
