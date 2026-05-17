import assert from "node:assert/strict";
import test from "node:test";

import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import { normalizeRymAlbumExtract } from "../src/core/normalizers/rym-album-normalizer.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  markDraftFieldConfirmed,
} from "../src/core/review/draft-review-state.js";
import { extractRymCurrentPage } from "../src/core/rym/rym-current-page-extractor.js";
import { validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../src/core/validation/schema-validation.js";

test("extracts visible metadata from a current RYM album page", () => {
  const document = fakeDocument({
    bodyText: [
      "Album",
      "Released 14 February 2025",
      "Genres: Art Pop, Synthpop",
      "Descriptors: melodic, lush",
      "1. Opening",
      "2. 夜の歌",
    ].join("\n"),
    selectors: {
      "h1": ["Test Album"],
      "a[href*='/artist/']": ["Artist Name"],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/album/artist-name/test-album/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Test Album");
  assert.equal(response.extract.artist, "Artist Name");
  assert.equal(response.extract.releaseDate, "2025-02-14");
  assert.deepEqual(response.extract.genres, ["Art Pop", "Synthpop"]);
  assert.deepEqual(response.extract.descriptors, ["melodic", "lush"]);
  assert.deepEqual(response.extract.tracks, ["1. Opening", "2. 夜の歌"]);
});

test("rejects non-RYM album pages without reading as supported", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({ bodyText: "Test Album" }),
    location: { href: "https://rateyourmusic.com/charts/top/album/2025/" },
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "unsupported_rym_page");
  assert.equal(response.page.reason, "not_rym_album_page");
});

test("maps RYM current-page extract into reviewable Douban draft without unsupported fill fields", () => {
  const metadata = normalizeRymAlbumExtract({
    provider: "rym",
    sourceType: "album",
    pageUrl: "https://rateyourmusic.com/release/album/artist-name/test-album/",
    fetchedAt: "2026-05-17T00:00:00.000Z",
    extractorVersion: "0.2.0-prototype",
    raw: {
      sourceUrl: "https://rateyourmusic.com/release/album/artist-name/test-album/",
      title: "Test Album",
      artist: "Artist Name",
      releaseDate: "2025",
      genres: ["Art Pop"],
      descriptors: ["melodic"],
      tracks: ["1. Opening", "2. Finale"],
    },
  });

  assert.deepEqual(validateAlbumReleaseMetadata(metadata), { ok: true, errors: [] });

  const draft = mapReleaseToDoubanDraft(metadata);
  assert.deepEqual(validateDoubanMusicDraft(draft), { ok: true, errors: [] });
  assert.equal(draft.fields.title.value, "Test Album");
  assert.equal(draft.fields.artists.value, "Artist Name");
  assert.equal(draft.fields.releaseDate.value, "2025");
  assert.equal(draft.fields.releaseDate.needsReview, true);
  assert.equal(draft.fields.genre.value, "Art Pop; melodic");
  assert.equal(draft.fields.genre.needsReview, true);
  assert.equal(draft.fields.tracks.value, "1 Opening\n2 Finale");
  assert.equal(draft.fields.externalLinks.value, "https://rateyourmusic.com/release/album/artist-name/test-album/");
  assert.equal(draft.fields.barcode, undefined);
  assert.equal(draft.fields.catalogNumber, undefined);
  assert.equal(draft.fields.media, undefined);
  assert.equal(draft.fields.publisher, undefined);
  assert.equal(draft.fields.coverImageUrl, undefined);

  let reviewState = createDraftReviewState({
    draft,
    sourceSummary: { provider: "rym", sourceType: "album" },
    warnings: metadata.warnings,
    validation: {},
    now: "2026-05-17T00:00:00.000Z",
  });
  for (const fieldName of ["title", "artists", "releaseDate", "tracks", "externalLinks", "genre"]) {
    reviewState = markDraftFieldConfirmed(reviewState, fieldName, {
      now: "2026-05-17T00:00:00.000Z",
    });
  }

  const fillPayload = getFillableDraftFields(reviewState);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "tracks", "externalLinks"]);
  assert.equal(fillPayload.genre, undefined);
});

function fakeDocument(options = {}) {
  const selectors = options.selectors || {};
  return {
    body: {
      innerText: options.bodyText || "",
      textContent: options.bodyText || "",
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      return (selectors[selector] || []).map((value) => ({ textContent: value }));
    },
  };
}
