"use client";

import { useCallback, useEffect, useRef } from "react";

import { useNetwork } from "@/contexts/NetworkContext";

type MessageValidator = (message: unknown) => boolean;

type PendingExpectation = {
  validate: MessageValidator;
  onResolve: (message: unknown) => void;
  onReject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
  failOnMismatch: boolean;
  mismatchMessage?: string;
};

export type ExpectMessageOptions = {
  timeoutMs?: number;
  mismatchMessage?: string;
  failOnMismatch?: boolean;
};

const DEFAULT_EXPECT_TIMEOUT = 5_000;

const describeMessage = (message: unknown): string => {
  if (!message || typeof message !== "object") {
    return String(message);
  }

  const maybeType = (message as { type?: unknown }).type;
  if (typeof maybeType === "string") {
    return `type=${maybeType}`;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return "[unserializable message]";
  }
};

function useProtocolRequest() {
  const { lastJsonMessage, sendJsonMessage } = useNetwork();
  const expectationsRef = useRef<PendingExpectation[]>([]);

  const removeExpectation = useCallback((target: PendingExpectation) => {
    expectationsRef.current = expectationsRef.current.filter(
      (item) => item !== target,
    );
  }, []);

  const resolveExpectation = useCallback(
    (target: PendingExpectation, message: unknown) => {
      if (target.timeoutId) {
        clearTimeout(target.timeoutId);
      }
      removeExpectation(target);
      target.onResolve(message);
    },
    [removeExpectation],
  );

  const rejectExpectation = useCallback(
    (target: PendingExpectation, error: Error) => {
      if (target.timeoutId) {
        clearTimeout(target.timeoutId);
      }
      removeExpectation(target);
      target.onReject(error);
    },
    [removeExpectation],
  );

  const createExpectation = useCallback(
    <TResult = unknown>(
      validator: MessageValidator,
      options?: ExpectMessageOptions,
    ) => {
      const {
        timeoutMs = DEFAULT_EXPECT_TIMEOUT,
        mismatchMessage,
        failOnMismatch = true,
      } = options ?? {};

      let expectation!: PendingExpectation;

      const promise = new Promise<TResult>((resolve, reject) => {
        expectation = {
          validate: validator,
          onResolve: (message) => resolve(message as TResult),
          onReject: reject,
          timeoutId: null,
          failOnMismatch,
          mismatchMessage,
        };

        if (timeoutMs > 0) {
          expectation.timeoutId = setTimeout(() => {
            rejectExpectation(
              expectation,
              new Error(
                `Timed out waiting for expected message after ${timeoutMs}ms`,
              ),
            );
          }, timeoutMs);
        }

        expectationsRef.current.push(expectation);
      });

      const cancel = (reason?: Error) => {
        if (!expectation) {
          return;
        }
        rejectExpectation(
          expectation,
          reason ?? new Error("Expectation cancelled"),
        );
      };

      return { promise, cancel, expectation };
    },
    [rejectExpectation],
  );

  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }

    const message = lastJsonMessage as unknown;
    const snapshot = expectationsRef.current.slice();

    snapshot.forEach((expectation) => {
      // Skip if already settled by an earlier expectation in this loop
      if (!expectationsRef.current.includes(expectation)) {
        return;
      }

      let isMatch = false;
      try {
        isMatch = expectation.validate(message);
      } catch (error) {
        const rejection =
          error instanceof Error
            ? error
            : new Error(String(error ?? "Unexpected validation error"));
        rejectExpectation(expectation, rejection);
        return;
      }

      if (isMatch) {
        resolveExpectation(expectation, message);
        return;
      }

      if (expectation.failOnMismatch) {
        const mismatchError = new Error(
          expectation.mismatchMessage
            ? `${expectation.mismatchMessage}. Received ${describeMessage(message)}`
            : `Unexpected message received while waiting for a response. Got ${describeMessage(message)}`,
        );
        rejectExpectation(expectation, mismatchError);
      }
    });
  }, [lastJsonMessage, rejectExpectation, resolveExpectation]);

  useEffect(() => {
    return () => {
      const pending = expectationsRef.current.slice();
      pending.forEach((expectation) => {
        rejectExpectation(
          expectation,
          new Error("Listener disposed before expected response arrived"),
        );
      });
      expectationsRef.current = [];
    };
  }, [rejectExpectation]);

  const expectMessage = useCallback(
    <TResult = unknown>(
      validator: MessageValidator,
      options?: ExpectMessageOptions,
    ): Promise<TResult> => {
      const { promise } = createExpectation<TResult>(validator, options);
      return promise;
    },
    [createExpectation],
  );

  const sendAndExpect = useCallback(
    async <TResult = unknown>(
      message: Record<string, unknown>,
      validator: MessageValidator,
      options?: ExpectMessageOptions,
    ): Promise<TResult> => {
      const { promise, cancel } = createExpectation<TResult>(
        validator,
        options,
      );

      try {
        await sendJsonMessage(message);
      } catch (error) {
        const reason =
          error instanceof Error
            ? error
            : new Error(`Failed to send WebSocket message: ${String(error)}`);
        cancel(reason);
        throw reason;
      }

      return promise;
    },
    [createExpectation, sendJsonMessage],
  );

  const cancelAllExpectations = useCallback(() => {
    const pending = expectationsRef.current.slice();
    pending.forEach((expectation) => {
      rejectExpectation(
        expectation,
        new Error("Expectation cancelled manually"),
      );
    });
    expectationsRef.current = [];
  }, [rejectExpectation]);

  return {
    expectMessage,
    sendAndExpect,
    cancelAllExpectations,
  };
}

export default useProtocolRequest;
