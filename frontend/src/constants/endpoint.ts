export const DEFAULT_SERVER_HOST = "localhost:3000";

const ensureHttpProtocol = (host: string) => {
  if (/^https?:\/\//i.test(host)) {
    return host;
  }
  return `http://${host}`;
};

export const buildEndpoint = (host: string) => {
  const sanitized = host?.trim() || DEFAULT_SERVER_HOST;
  const withProtocol = ensureHttpProtocol(sanitized);
  return `${withProtocol.replace(/\/$/, "")}/chat`;
};
