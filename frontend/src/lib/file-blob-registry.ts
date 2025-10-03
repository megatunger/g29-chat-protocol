const blobRegistry = new Map<string, File>();

export const getBlobUrlForFile = (file: File) => {
  const blobUrl = URL.createObjectURL(file);
  blobRegistry.set(blobUrl, file);
  return blobUrl;
};

export const getFileForBlobUrl = (blobUrl: string) => {
  return blobRegistry.get(blobUrl) ?? null;
};

export const revokeBlobUrl = (blobUrl: string) => {
  if (!blobRegistry.has(blobUrl)) {
    return;
  }

  URL.revokeObjectURL(blobUrl);
  blobRegistry.delete(blobUrl);
};

export const clearBlobRegistry = () => {
  for (const blobUrl of blobRegistry.keys()) {
    URL.revokeObjectURL(blobUrl);
  }

  blobRegistry.clear();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    clearBlobRegistry();
  });
}

export default blobRegistry;
