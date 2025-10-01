export const DEFAULT_SERVER_HOST = "localhost:3000";

const ensureProtocol = (host: string): string => {
  if (host.includes("://")) {
    return host;
  }

  return `http://${host}`;
};

const trimTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.replace(/\/+$/, "") : value;

export const buildEndpoint = (host?: string): string => {
  const sanitizedHost = (host ?? DEFAULT_SERVER_HOST).trim();
  const normalizedHost = sanitizedHost || DEFAULT_SERVER_HOST;
  const withProtocol = ensureProtocol(trimTrailingSlash(normalizedHost));

  return `${withProtocol}/chat`;
};
