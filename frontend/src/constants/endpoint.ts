export const endpoint =
  process.env.NODE_ENV !== "production"
    ? "http://localhost:3000/chat"
    : "http://localhost:3000/";
