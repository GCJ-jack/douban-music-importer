import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDraftFieldEdit,
  createDraftReviewState,
  getFillableDraftFields,
  listReviewFields,
  markDraftFieldConfirmed,
  markDraftFieldRemoved,
  summarizeReviewReadiness,
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
      artists: createDraftField("Artist", {
        sourceFields: ["release.artists"],
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
      externalLinks: createDraftField("https://www.discogs.com/release/1-Test", {
        sourceFields: ["source.url"],
        confidence: "high",
      }),
      catalogNumber: createDraftField("CAT-1", {
        sourceFields: ["release.catalogNumbers"],
        confidence: "high",
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
    fieldCount: 5,
    removedCount: 1,
    confirmedCount: 1,
    needsReviewCount: 1,
    unmappedCount: 1,
    warningCount: 1,
  });
  assert.deepEqual(listReviewFields(state).map((item) => item.name), [
    "title",
    "artists",
    "genre",
    "externalLinks",
    "catalogNumber",
  ]);
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

test("summarizes review readiness for confirmed fillable fields", () => {
  let state = createDraftReviewState({
    draft: draft(),
    now: "2026-05-10T00:00:00.000Z",
  });

  assert.deepEqual(summarizeReviewReadiness(state), {
    ready: false,
    fillableFieldCount: 3,
    confirmedFillableFieldCount: 0,
    unconfirmedFillableFieldCount: 3,
    unconfirmedFillableFields: ["title", "artists", "externalLinks"],
    unsupportedFieldCount: 3,
    unsupportedFields: ["genre", "coverImageUrl", "catalogNumber"],
  });

  state = markDraftFieldConfirmed(state, "title");
  state = markDraftFieldConfirmed(state, "artists");
  state = markDraftFieldConfirmed(state, "externalLinks");

  assert.deepEqual(summarizeReviewReadiness(state), {
    ready: true,
    fillableFieldCount: 3,
    confirmedFillableFieldCount: 3,
    unconfirmedFillableFieldCount: 0,
    unconfirmedFillableFields: [],
    unsupportedFieldCount: 3,
    unsupportedFields: ["genre", "coverImageUrl", "catalogNumber"],
  });
});

test("returns only confirmed, active, fillable draft fields", () => {
  let state = createDraftReviewState({
    draft: draft(),
    now: "2026-05-10T00:00:00.000Z",
  });

  state = markDraftFieldConfirmed(state, "title");
  state = markDraftFieldConfirmed(state, "artists");
  state = markDraftFieldConfirmed(state, "genre");
  state = markDraftFieldConfirmed(state, "coverImageUrl");
  state = markDraftFieldConfirmed(state, "externalLinks");
  state = markDraftFieldRemoved(state, "artists");

  const fillable = getFillableDraftFields(state);

  assert.deepEqual(Object.keys(fillable), ["title", "externalLinks"]);
  assert.equal(fillable.title.value, "Album");
  assert.equal(fillable.externalLinks.value, "https://www.discogs.com/release/1-Test");
  assert.equal(fillable.genre, undefined);
  assert.equal(fillable.coverImageUrl, undefined);
  assert.equal(fillable.artists, undefined);
});
