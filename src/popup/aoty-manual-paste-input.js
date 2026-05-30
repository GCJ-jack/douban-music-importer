export const AOTY_MANUAL_PASTE_INPUT_KEY = "aotyManualPasteInput";

export function isAotyAlbumUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return false;
  }

  if (!["albumoftheyear.org", "www.albumoftheyear.org"].includes(url.hostname.toLowerCase())) {
    return false;
  }

  return /^\/album\/\d+-/i.test(url.pathname);
}

export function createAotyManualPasteInputDraft(input = {}) {
  return {
    sourceUrl: cleanString(input.sourceUrl),
    text: String(input.text || ""),
  };
}

export async function loadAotyManualPasteInputDraft(storageArea) {
  if (!isStorageArea(storageArea)) {
    return createAotyManualPasteInputDraft();
  }

  try {
    const result = await storageArea.get(AOTY_MANUAL_PASTE_INPUT_KEY);
    return createAotyManualPasteInputDraft(result?.[AOTY_MANUAL_PASTE_INPUT_KEY]);
  } catch {
    return createAotyManualPasteInputDraft();
  }
}

export async function saveAotyManualPasteInputDraft(storageArea, input) {
  if (!isStorageArea(storageArea)) {
    return false;
  }

  try {
    await storageArea.set({
      [AOTY_MANUAL_PASTE_INPUT_KEY]: createAotyManualPasteInputDraft(input),
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearAotyManualPasteInputDraft(storageArea) {
  if (!isStorageArea(storageArea)) {
    return false;
  }

  try {
    await storageArea.remove(AOTY_MANUAL_PASTE_INPUT_KEY);
    return true;
  } catch {
    return false;
  }
}

function isStorageArea(storageArea) {
  return Boolean(
    storageArea &&
    typeof storageArea.get === "function" &&
    typeof storageArea.set === "function" &&
    typeof storageArea.remove === "function",
  );
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
