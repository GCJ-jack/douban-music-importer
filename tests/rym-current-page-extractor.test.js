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
    selectors: {
      "h1": ["Test Album"],
      "a[href*='/artist/']": ["Artist Name"],
      ".release_info tr": [
        "Released 14 February 2025",
        "Genres: Art Pop, Synthpop",
        "Descriptors: melodic, lush",
      ],
      ".tracklist tr": [
        "1. Opening",
        "2. 夜の歌",
      ],
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
  assert.deepEqual(response.extract.tracks, ["1 Opening", "2 夜の歌"]);
});

test("filters RYM track rating widget and script noise from tracklist", () => {
  const document = fakeDocument({
    selectors: {
      "h1": ["Noisy Album"],
      "a[href*='/artist/']": ["Artist Name"],
      ".release_info tr": ["Released 1996"],
      ".tracklist tr": [
        "1. Clean Opener",
        "Saving...",
        "rymQ(function(){ track_ratings.init(); })",
        "track_ratings 2. Polluted",
        "2. Clean Closer 3:45",
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/album/artist-name/noisy-album/" },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, ["1 Clean Opener", "2 Clean Closer"]);
});

test("deduplicates repeated Entire album tracklist entries by position and title", () => {
  const document = fakeDocument({
    selectors: {
      "h1": ["Repeated Album"],
      "a[href*='/artist/']": ["Artist Name"],
      ".release_info tr": ["Released 14 February 2025"],
      ".tracklist tr": [
        "1. Opening",
        "2. Finale",
        "Entire album",
        "1. Opening",
        "2. Finale",
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/album/artist-name/repeated-album/" },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, ["1 Opening", "2 Finale"]);
});

test("extracts RYM track table rows without appending inline duplicated tracklist", () => {
  const trackRows = [
    ["A1", "Crack Farm"],
    ["A2", "We Need to Find the Girls"],
    ["A3", "The Son's Room"],
    ["A4", "With Her Shadow"],
    ["A5", "Watching the Burn"],
    ["B1", "Floods of Tears"],
    ["B2", "Freak Show"],
    ["B3", "Goodbye"],
    ["B4", "Coaster"],
    ["B5", "The Horse"],
    ["B6", "The Discovery of Oxygen"],
  ].map(([position, title]) => fakeRow([
    position,
    title,
    "Saving...",
    "rymQ(function(){ track_ratings.init(); })",
  ]));

  const document = fakeDocument({
    selectors: {
      "h1": ["Tragedy By The Vehicle Birth"],
      ".release_info tr": ["Released 1996"],
      ".tracklist tr": trackRows,
      ".tracklist": [
        [
          "A1 Crack Farm",
          "A2 We Need to Find the Girls",
          "A3 The Son's Room",
          "A4 With Her Shadow",
          "A5 Watching the Burn",
          "B1 Floods of Tears",
          "B2 Freak Show",
          "B3 Goodbye",
          "B4 Coaster",
          "B5 The Horse",
          "B6 The Discovery of Oxygen",
          "A1 Crack Farm A2 We Need to Find the Girls A3 The Son's Room",
          "Saving...",
          "rymQ(function(){ track_ratings.init(); })",
        ].join("\n"),
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/album/the-vehicle-birth/tragedy/" },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, [
    "A1 Crack Farm",
    "A2 We Need to Find the Girls",
    "A3 The Son's Room",
    "A4 With Her Shadow",
    "A5 Watching the Burn",
    "B1 Floods of Tears",
    "B2 Freak Show",
    "B3 Goodbye",
    "B4 Coaster",
    "B5 The Horse",
    "B6 The Discovery of Oxygen",
  ]);
  assert.equal(response.extract.tracks.length, 11);
  assert.equal(response.extract.tracks.some((track) => track.includes("A1 Crack Farm A2")), false);
  assert.equal(response.extract.tracks.some((track) => /Saving\.\.\.|rymQ\(/.test(track)), false);
});

test("keeps exact RYM inline duplicate out of final Douban draft tracks", () => {
  const document = fakeDocument({
    selectors: {
      "h1": ["Tragedy By The Vehicle Birth"],
      ".release_info tr": ["Released 1996"],
      ".tracklist li": [
        "A1 Crack Farm",
        "A2 We Need to Find the Girls",
        "A3 The Son's Room",
        "A4 With Her Shadow",
        "A5 Watching the Burn",
        "B1 Floods of Tears",
        "B2 Freak Show",
        "B3 Goodbye",
        "B4 Coaster",
        "B5 The Horse",
        "B6 The Discovery of Oxygen",
        "A1 Crack Farm A2 We Need to Find the Girls A3 The Son's Room A4 With Her Shadow A5 Watching the Burn B1 Floods of Tears B2 Freak Show B3 Goodbye B4 Coaster B5 The Horse B6 The Discovery of Oxygen",
        "Saving...",
        "rymQ(function(){ track_ratings.init(); })",
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/album/the-vehicle-birth/tragedy/" },
  });
  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, [
    "A1 Crack Farm",
    "A2 We Need to Find the Girls",
    "A3 The Son's Room",
    "A4 With Her Shadow",
    "A5 Watching the Burn",
    "B1 Floods of Tears",
    "B2 Freak Show",
    "B3 Goodbye",
    "B4 Coaster",
    "B5 The Horse",
    "B6 The Discovery of Oxygen",
  ]);

  const metadata = normalizeRymAlbumExtract({
    raw: response.extract,
    pageUrl: response.extract.sourceUrl,
    fetchedAt: "2026-05-17T00:00:00.000Z",
  });
  const draft = mapReleaseToDoubanDraft(metadata);
  const draftTrackLines = draft.fields.tracks.value.split("\n");

  assert.equal(draftTrackLines.length, 11);
  assert.equal(draft.fields.tracks.value.includes("A1 Crack Farm A2 We Need"), false);
  assert.equal(draft.fields.tracks.value.includes("Saving..."), false);
  assert.equal(draft.fields.tracks.value.includes("rymQ("), false);
  assert.deepEqual(draftTrackLines, [
    "A1 Crack Farm",
    "A2 We Need to Find the Girls",
    "A3 The Son's Room",
    "A4 With Her Shadow",
    "A5 Watching the Burn",
    "B1 Floods of Tears",
    "B2 Freak Show",
    "B3 Goodbye",
    "B4 Coaster",
    "B5 The Horse",
    "B6 The Discovery of Oxygen",
  ]);
});

test("splits RYM album heading Title By Artist into title and artist", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["Tragedy By The Vehicle Birth"],
        ".release_info tr": ["Released 1996"],
        ".tracklist tr": ["1. The Early Year"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/album/the-vehicle-birth/tragedy/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Tragedy");
  assert.equal(response.extract.artist, "The Vehicle Birth");
  assert.notEqual(response.extract.title, "Tragedy By The Vehicle Birth");
});

test("splits RYM album heading Title by Artist case-insensitively", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["Tragedy by The Vehicle Birth"],
        ".release_info tr": ["Released 1996"],
        ".tracklist tr": ["1. The Early Year"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/album/the-vehicle-birth/tragedy/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Tragedy");
  assert.equal(response.extract.artist, "The Vehicle Birth");
  assert.notEqual(response.extract.title, "Tragedy by The Vehicle Birth");
});

test("prefers explicit album title and artist link over combined heading", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        ".album_title": ["Tragedy"],
        "h1": ["Tragedy By The Vehicle Birth"],
        "a[href*='/artist/']": ["The Vehicle Birth"],
        ".release_info tr": ["Released 1996"],
        ".tracklist tr": ["1. The Early Year"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/album/the-vehicle-birth/tragedy/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Tragedy");
  assert.equal(response.extract.artist, "The Vehicle Birth");
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

test("rejects RYM artist and person pages as unsupported", () => {
  for (const href of [
    "https://rateyourmusic.com/artist/artist-name/",
    "https://rateyourmusic.com/person/person-name/",
    "https://rateyourmusic.com/release/single/artist-name/test-single/",
  ]) {
    const response = extractRymCurrentPage({
      document: fakeDocument({
        selectors: {
          "h1": ["Artist Name"],
          "a[href*='/artist/']": ["Artist Name"],
          ".release_info tr": ["Released 1996"],
        },
      }),
      location: { href },
    });

    assert.equal(response.ok, false);
    assert.equal(response.code, "unsupported_rym_page");
  }
});

test("rejects release album URLs without matching album release DOM", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["Artist Name"],
        ".release_info tr": ["RYM Rating 3.80 Ranked #12"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/album/artist-name/not-an-album-dom/" },
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "unsupported_dom");
  assert.equal(response.extract, null);
});

test("parses Released year with year precision through the RYM normalizer", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["Year Album"],
        "a[href*='/artist/']": ["Artist Name"],
        ".release_info tr": ["Released 1996"],
        ".tracklist tr": ["1. Opening"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/album/artist-name/year-album/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.releaseDate, "1996");

  const metadata = normalizeRymAlbumExtract({
    raw: response.extract,
    pageUrl: response.extract.sourceUrl,
    fetchedAt: "2026-05-17T00:00:00.000Z",
  });
  assert.deepEqual(metadata.release.releaseDate, { value: "1996", precision: "year" });
});

test("does not infer release date from RYM Rating or Ranked text", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["Undated Album"],
        "a[href*='/artist/']": ["Artist Name"],
        ".release_info tr": ["RYM Rating 3.96 Ranked #12 for 1996"],
        ".tracklist tr": ["1. Opening"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/album/artist-name/undated-album/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.releaseDate, "");
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
  const createNode = (value) => {
    if (typeof value === "object" && value !== null) {
      return value;
    }
    return {
      textContent: value,
      querySelectorAll() {
        return [];
      },
    };
  };
  return {
    body: {
      innerText: options.bodyText || "",
      textContent: options.bodyText || "",
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      return (selectors[selector] || []).map(createNode);
    },
  };
}

function fakeRow(cells) {
  const cellNodes = cells.map((value) => ({
    textContent: value,
    querySelectorAll() {
      return [];
    },
  }));
  return {
    textContent: cells.join(" "),
    querySelector(selector) {
      if (/position|tracknum|pos/.test(selector)) return cellNodes[0] || null;
      if (/title/.test(selector)) return cellNodes[1] || null;
      return null;
    },
    querySelectorAll(selector) {
      return selector === "td, th" ? cellNodes : [];
    },
  };
}
