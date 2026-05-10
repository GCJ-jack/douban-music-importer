import assert from "node:assert/strict";
import test from "node:test";

import { createDraftReviewState } from "../src/core/review/draft-review-state.js";
import { createDraftField } from "../src/core/schema/douban-draft.js";
import {
  clearDraftReviewState,
  confirmDraftField,
  getDraftReviewState,
  removeDraftField,
  saveDraftReviewState,
  updateDraftField,
} from "../src/storage/draft-store.js";

function createChromeMock() {
  const sessionStore = {};
  const localStore = {};

  return {
    sessionStore,
    localStore,
    chromeApi: {
      storage: {
        session: createStorageArea(sessionStore),
        local: createStorageArea(localStore),
      },
    },
  };
}

function createLocalOnlyChromeMock() {
  const localStore = {};

  return {
    localStore,
    chromeApi: {
      storage: {
        local: createStorageArea(localStore),
      },
    },
  };
}

function createStorageArea(store) {
  return {
    async set(values) {
      Object.assign(store, values);
    },
    async get(key) {
      return {
        [key]: store[key],
      };
    },
    async remove(key) {
      delete store[key];
    },
  };
}

function reviewState() {
  return createDraftReviewState({
    draft: {
      schemaVersion: "0.1",
      sourceUrl: "https://www.discogs.com/release/1-Test",
      attribution: "Metadata imported from Discogs release 1.",
      fields: {
        title: createDraftField("Album", {
          sourceFields: ["release.title"],
          confidence: "high",
        }),
      },
      unmapped: [],
    },
    now: "2026-05-10T00:00:00.000Z",
  });
}

test("saves active draft review state to session storage by default", async () => {
  const { chromeApi, sessionStore, localStore } = createChromeMock();
  const state = reviewState();

  await saveDraftReviewState(state, { chromeApi });
  const saved = await getDraftReviewState({ chromeApi });

  assert.equal(saved.draft.fields.title.value, "Album");
  assert.ok(sessionStore.currentDoubanMusicDraftReviewState);
  assert.equal(localStore.currentDoubanMusicDraftReviewState, undefined);
});

test("falls back to local storage when session storage is unavailable", async () => {
  const { chromeApi, localStore } = createLocalOnlyChromeMock();

  await saveDraftReviewState(reviewState(), { chromeApi });

  assert.ok(localStore.currentDoubanMusicDraftReviewState);
});

test("updates, confirms, removes, and clears current draft fields", async () => {
  const { chromeApi } = createChromeMock();

  await saveDraftReviewState(reviewState(), { chromeApi });

  let next = await updateDraftField("title", "Edited Album", { chromeApi });
  assert.equal(next.draft.fields.title.value, "Edited Album");
  assert.equal(next.fieldReview.title.confirmed, false);

  next = await confirmDraftField("title", { chromeApi });
  assert.equal(next.fieldReview.title.confirmed, true);

  next = await removeDraftField("title", { chromeApi });
  assert.equal(next.fieldReview.title.removed, true);
  assert.equal(next.fieldReview.title.confirmed, false);

  await clearDraftReviewState({ chromeApi });
  assert.equal(await getDraftReviewState({ chromeApi }), null);
});
