import { v4 as uuidv4 } from "uuid";

export const clientVersion = "g29-v1";

export const generateUserID = (userID: string) => {
  return `${userID}${uuidv4().substring(0, 3)}`;
};

export const DEFAULT_EXPECTED_TYPE = "ACK";

export type useSendAndExpectOptions = {
  expectedType?: string;
  timeoutMs?: number;
  validate?: (message: unknown) => boolean;
};
