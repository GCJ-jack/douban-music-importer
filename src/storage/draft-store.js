import {
  applyDraftFieldEdit,
  markDraftFieldConfirmed,
  markDraftFieldRemoved,
} from "../core/review/draft-review-state.js";

const DRAFT_REVIEW_STATE_KEY = "currentDoubanMusicDraftReviewState";

export async function saveDraftReviewState(reviewState, options = {}) {
  await getStorageArea(options.chromeApi).set({
    [DRAFT_REVIEW_STATE_KEY]: reviewState,
  });
  return reviewState;
}

export async function getDraftReviewState(options = {}) {
  const result = await getStorageArea(options.chromeApi).get(DRAFT_REVIEW_STATE_KEY);
  return result[DRAFT_REVIEW_STATE_KEY] || null;
}

export async function updateDraftField(fieldName, value, options = {}) {
  const current = await requireDraftReviewState(options);
  const next = applyDraftFieldEdit(current, fieldName, value);
  return saveDraftReviewState(next, options);
}

export async function confirmDraftField(fieldName, options = {}) {
  const current = await requireDraftReviewState(options);
  const next = markDraftFieldConfirmed(current, fieldName);
  return saveDraftReviewState(next, options);
}

export async function removeDraftField(fieldName, options = {}) {
  const current = await requireDraftReviewState(options);
  const next = markDraftFieldRemoved(current, fieldName);
  return saveDraftReviewState(next, options);
}

export async function clearDraftReviewState(options = {}) {
  await getStorageArea(options.chromeApi).remove(DRAFT_REVIEW_STATE_KEY);
}

function getStorageArea(chromeApi = globalThis.chrome) {
  const storage = chromeApi?.storage;
  const area = storage?.session || storage?.local;

  if (!area) {
    throw new Error("chrome.storage.session or chrome.storage.local is required.");
  }

  return area;
}

async function requireDraftReviewState(options) {
  const current = await getDraftReviewState(options);
  if (!current) {
    throw new Error("No active Douban draft review state.");
  }
  return current;
}
