const RAW_SOURCE_KEY = "currentRawSourceMetadata";

export async function saveRawSourceMetadata(metadata) {
  await chrome.storage.local.set({
    [RAW_SOURCE_KEY]: metadata,
  });
  return metadata;
}

export async function getRawSourceMetadata() {
  const result = await chrome.storage.local.get(RAW_SOURCE_KEY);
  return result[RAW_SOURCE_KEY] || null;
}

export async function clearRawSourceMetadata() {
  await chrome.storage.local.remove(RAW_SOURCE_KEY);
}
