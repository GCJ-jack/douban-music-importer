import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDraftFieldEdit,
  createDraftReviewState,
  listReviewFields,
  markDraftFieldConfirmed,
  markDraftFieldRemoved,
  summarizeDraftReviewState,
} from "../src/core/review/draft-review-state.js";
import { createDraftField } from "../src/core/schema/douban-draft.js";

function draft() {
  return {
    schemaVersion: "0.1",
    sourceUrl: "https://www.discogs.com/release/1-Test",
    attribution: "Metadata imported from Discogs release 1.",
    fields: {
      title: createDraftField("Album", {
        sourceFields: ["release.title"],
        confidence: "high",
      }),
      genre: createDraftField("Electronic; Ambient", {
        sourceFields: ["release.genres", "release.styles"],
        confidence: "medium",
        needsReview: true,
      }),
      coverImageUrl: createDraftField("https://img.discogs.com/cover.jpg", {
        sourceFields: ["release.coverImage"],
        confidence: "medium",
        needsReview: true,
      }),
    },
    unmapped: [
      {
        sourceField: "release.country",
        value: "Japan",
        reason: "No dedicated field.",
      },
    ],
  };
}

test("creates review state without mutating DraftField schema", () => {
  const state = createDraftReviewState({
    draft: draft(),
    warnings: [{ level: "warning", message: "Review genre." }],
    now: "2026-05-10T00:00:00.000Z",
  });

  assert.equal(state.schemaVersion, "0.1");
  assert.equal(state.status, "reviewing");
  assert.equal(state.fieldReview.title.confirmed, false);
  assert.equal(state.fieldReview.title.removed, false);
  assert.equal(Object.hasOwn(state.draft.fields.title, "confirmed"), false);
  assert.equal(Object.hasOwn(state.draft.fields.title, "removed"), false);
});

test("summarizes active, confirmed, needsReview, unmapped, and warning counts", () => {
  let state = createDraftReviewState({
    draft: draft(),
    warnings: [{ level: "warning", message: "Review genre." }],
    now: "2026-05-10T00:00:00.000Z",
  });

  state = markDraftFieldConfirmed(state, "title", {
    now: "2026-05-10T00:01:00.000Z",
  });
  state = markDraftFieldRemoved(state, "coverImageUrl", {
    now: "2026-05-10T00:02:00.000Z",
  });

  assert.deepEqual(summarizeDraftReviewState(state), {
    fieldCount: 2,
    removedCount: 1,
    confirmedCount: 1,
    needsReviewCount: 1,
    unmappedCount: 1,
    warningCount: 1,
  });
  assert.deepEqual(listReviewFields(state).map((item) => item.name), ["title", "genre"]);
});

test("editing a field updates value and clears confirmation", () => {
  let state = createDraftReviewState({
    draft: draft(),
    now: "2026-05-10T00:00:00.000Z",
  });

  state = markDraftFieldConfirmed(state, "title", {
    now: "2026-05-10T00:01:00.000Z",
  });
  state = applyDraftFieldEdit(state, "title", "Edited Album", {
    now: "2026-05-10T00:02:00.000Z",
  });

  assert.equal(state.draft.fields.title.value, "Edited Album");
  assert.equal(state.fieldReview.title.confirmed, false);
  assert.equal(state.fieldReview.title.removed, false);
});

test("throws for unknown review fields", () => {
  const state = createDraftReviewState({
    draft: draft(),
  });

  assert.throws(
    () => markDraftFieldConfirmed(state, "missing"),
    /Unknown draft field: missing/,
  );
});
