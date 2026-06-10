import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildBandcampCurrentPageImport } from "../src/core/bandcamp/bandcamp-current-page-import.js";
import {
  formatReviewSourceSummary,
  getFillableDraftFields,
  markDraftFieldConfirmed,
} from "../src/core/review/draft-review-state.js";
import { parseBandcampAlbumPageUrl } from "../src/popup/bandcamp-page-detection.js";
import {
  DARK_ANGELS_SOURCE_URL,
  DARK_ANGELS_TRACKS,
} from "./fixtures/bandcamp-dark-angels-fixture.js";

test("detects only Bandcamp subdomain album pages for the popup entry", () => {
  assert.deepEqual(parseBandcampAlbumPageUrl(DARK_ANGELS_SOURCE_URL), {
    supported: true,
    reason: "bandcamp_album_page",
  });
  assert.equal(parseBandcampAlbumPageUrl(`${DARK_ANGELS_SOURCE_URL}?from=discover`).supported, true);

  for (const url of [
    "https://xumstudios.bandcamp.com/track/bloody-mary",
    "https://bandcamp.com/album/dark-angels",
    "https://example.com/album/dark-angels",
    "not a url",
  ]) {
    assert.equal(parseBandcampAlbumPageUrl(url).supported, false, url);
  }
});

test("builds Bandcamp current-page workflow result and review source summary", () => {
  const result = buildBandcampCurrentPageImport(darkAngelsInjection(), {
    fetchedAt: "2026-06-10T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.sourceMetadata.provider, "bandcamp");
  assert.equal(result.sourceMetadata.sourceMode, "currentPage");
  assert.deepEqual(Object.keys(result.sourceMetadata.raw).sort(), [
    "artist",
    "coverVisible",
    "formats",
    "hostingPublishers",
    "provider",
    "releaseDate",
    "sourceMode",
    "sourceType",
    "sourceUrl",
    "tags",
    "title",
    "tracks",
    "warnings",
  ]);
  assert.match(formatReviewSourceSummary(result.reviewState), /^来源：Bandcamp current page\nURL: /);
  assert.equal(result.metadataSummary.title, "Dark Angels");
  assert.equal(result.metadataSummary.artist, "SpaceGhostPurrp");
  assert.equal(result.metadataSummary.normalizedValid, true);
  assert.equal(result.metadataSummary.draftValid, true);
});

test("Bandcamp workflow keeps review-only fields out of confirmed safe-fill", () => {
  const result = buildBandcampCurrentPageImport(darkAngelsInjection(), {
    fetchedAt: "2026-06-10T00:00:00.000Z",
  });
  let reviewState = result.reviewState;

  for (const fieldName of Object.keys(reviewState.draft.fields)) {
    reviewState = markDraftFieldConfirmed(reviewState, fieldName);
  }

  assert.deepEqual(Object.keys(getFillableDraftFields(reviewState)), [
    "title",
    "artists",
    "releaseDate",
    "tracks",
    "externalLinks",
  ]);
  assert.equal(JSON.stringify(result.sourceMetadata).includes("price"), false);
  assert.equal(JSON.stringify(result.sourceMetadata).includes("audio"), false);
  assert.equal(JSON.stringify(result.sourceMetadata).includes("image"), false);
  assert.equal(JSON.stringify(result.sourceMetadata).includes("comment"), false);
});

test("Bandcamp workflow maps unsupported extraction errors without creating draft state", () => {
  assert.deepEqual(buildBandcampCurrentPageImport({
    ok: false,
    code: "unsupported_bandcamp_dom",
    message: "Unsupported DOM",
    page: { supported: false, reason: "unsupported_dom" },
    warnings: [],
  }), {
    ok: false,
    page: { supported: false, reason: "unsupported_dom" },
    error: {
      code: "unsupported_bandcamp_dom",
      message: "Unsupported DOM",
    },
    warnings: [],
  });
});

test("service worker and popup expose the user-initiated Bandcamp current-page action", () => {
  const worker = readFileSync(new URL("../src/background/service-worker.js", import.meta.url), "utf8");
  const popupHtml = readFileSync(new URL("../src/popup/popup.html", import.meta.url), "utf8");
  const popupJs = readFileSync(new URL("../src/popup/popup.js", import.meta.url), "utf8");

  assert.match(worker, /IMPORT_BANDCAMP_CURRENT_PAGE/);
  assert.match(worker, /func: extractBandcampCurrentPage/);
  assert.match(popupHtml, /读取当前 Bandcamp 页面/);
  assert.match(popupJs, /type: "IMPORT_BANDCAMP_CURRENT_PAGE"/);
  assert.doesNotMatch(popupJs, /IMPORT_BANDCAMP_CURRENT_PAGE[\s\S]*addEventListener\("load"/);
});

function darkAngelsInjection() {
  return {
    ok: true,
    page: {
      supported: true,
      reason: "bandcamp_album_page",
      url: DARK_ANGELS_SOURCE_URL,
    },
    warnings: [],
    extract: {
      provider: "bandcamp",
      sourceType: "album",
      sourceMode: "currentPage",
      sourceUrl: DARK_ANGELS_SOURCE_URL,
      title: "Dark Angels",
      artist: "SpaceGhostPurrp",
      releaseDate: "2023-11-20",
      tracks: DARK_ANGELS_TRACKS,
      tags: ["hip-hop/rap", "dark trap"],
      hostingPublishers: ["XUM"],
      formats: [],
      coverVisible: false,
      warnings: [],
    },
  };
}
