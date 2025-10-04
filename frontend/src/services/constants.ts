export const clientVersion = "g29-v1";

export const generateUserID = (userID: string) => {
  return `${userID}`;
};

export const DEFAULT_EXPECTED_TYPE = "ACK";

export type useSendAndExpectOptions = {
  expectedType?: string;
  timeoutMs?: number;
  validate?: (message: unknown) => boolean;
};
