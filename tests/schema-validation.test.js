import assert from "node:assert/strict";
import test from "node:test";

import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import { normalizeDiscogsRelease } from "../src/core/normalizers/discogs-release-normalizer.js";
import { validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../src/core/validation/schema-validation.js";

test("validates normalized release metadata and Douban draft", () => {
  const metadata = normalizeDiscogsRelease({
    provider: "discogs",
    sourceType: "release",
    releaseId: "123",
    apiUrl: "https://api.discogs.com/releases/123",
    pageUrl: "https://www.discogs.com/release/123-Example",
    fetchedAt: "2026-05-10T00:00:00.000Z",
    extractorVersion: "0.1.0",
    raw: {
      id: 123,
      title: "Example",
      artists: [{ name: "Artist" }],
      released: "2024-01-02",
      labels: [{ name: "Label", catno: "ABC-123" }],
      formats: [{ name: "CD", qty: "1" }],
      genres: ["Rock"],
      styles: [],
      identifiers: [{ type: "Barcode", value: "1234567890" }],
      tracklist: [{ position: "1", title: "Track One" }],
      uri: "https://www.discogs.com/release/123-Example",
    },
  });

  const draft = mapReleaseToDoubanDraft(metadata);

  assert.deepEqual(validateAlbumReleaseMetadata(metadata), { ok: true, errors: [] });
  assert.deepEqual(validateDoubanMusicDraft(draft), { ok: true, errors: [] });
});

test("reports schema errors for invalid metadata", () => {
  const result = validateAlbumReleaseMetadata({
    schemaVersion: "0.1",
    source: {},
    release: {
      title: "",
    },
    confidence: {
      "release.title": "certain",
    },
    provenance: {},
    warnings: [{ level: "warning", message: "Missing fields." }],
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("release.title must be a non-empty string"));
  assert.ok(result.errors.includes("confidence.release.title must be one of high, medium, low"));
  assert.ok(result.errors.includes("release.artists must be an array"));
});
