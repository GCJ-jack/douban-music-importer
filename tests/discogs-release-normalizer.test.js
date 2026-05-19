import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDiscogsRelease } from "../src/core/normalizers/discogs-release-normalizer.js";

function source(raw) {
  return {
    provider: "discogs",
    sourceType: "release",
    releaseId: String(raw.id || 100),
    apiUrl: `https://api.discogs.com/releases/${raw.id || 100}`,
    pageUrl: raw.uri || `https://www.discogs.com/release/${raw.id || 100}-Fixture`,
    fetchedAt: "2026-05-10T00:00:00.000Z",
    extractorVersion: "0.1.0",
    raw,
  };
}

function masterSource(raw) {
  return {
    provider: "discogs",
    sourceType: "master",
    masterId: String(raw.id || 1541661),
    apiUrl: `https://api.discogs.com/masters/${raw.id || 1541661}`,
    pageUrl: raw.uri || `https://www.discogs.com/master/${raw.id || 1541661}-Fixture`,
    fetchedAt: "2026-05-10T00:00:00.000Z",
    extractorVersion: "0.1.0",
    raw,
  };
}

test("normalizes a standard Discogs CD release", () => {
  const metadata = normalizeDiscogsRelease(source({
    id: 100,
    title: "Example Album",
    artists: [{ name: "Example Artist", join: "" }],
    released: "2024-03-15",
    country: "US",
    labels: [{ name: "Example Label", catno: "EX-100", resource_url: "https://api.discogs.com/labels/1" }],
    formats: [{ name: "CD", qty: "1", descriptions: ["Album"] }],
    genres: ["Rock"],
    styles: ["Indie Rock"],
    identifiers: [{ type: "Barcode", value: "1234567890123" }],
    tracklist: [
      { position: "1", title: "First Song", duration: "3:10" },
      { position: "2", title: "Second Song", duration: "4:02" },
    ],
    images: [{ type: "primary", uri: "https://img.discogs.com/example.jpg" }],
    uri: "https://www.discogs.com/release/100-Example-Album",
  }));

  assert.equal(metadata.schemaVersion, "0.1");
  assert.equal(metadata.release.title, "Example Album");
  assert.equal(metadata.release.artists[0].name, "Example Artist");
  assert.deepEqual(metadata.release.releaseDate, { value: "2024-03-15", precision: "day" });
  assert.equal(metadata.release.labels[0].catalogNumber, "EX-100");
  assert.equal(metadata.release.formats[0].type, "CD");
  assert.equal(metadata.release.identifiers[0].type, "Barcode");
  assert.equal(metadata.release.tracklist[1].title, "Second Song");
  assert.equal(metadata.release.coverImage.url, "https://img.discogs.com/example.jpg");
  assert.equal(metadata.confidence["release.title"], "high");
});

test("preserves multi-value Discogs metadata and special characters", () => {
  const metadata = normalizeDiscogsRelease(source({
    id: 101,
    title: "東京 Café / Niño",
    artists: [
      { name: "坂本龍一", join: " & " },
      { anv: "Björk", name: "Bjork", join: "" },
    ],
    released: "2023-08-00",
    labels: [
      { name: "Label 一", catno: "L-001" },
      { name: "Label Deux", catno: "L-002" },
    ],
    formats: [
      { name: "Vinyl", qty: "2", descriptions: ["LP", "Album"] },
      { name: "File", qty: "1", descriptions: ["FLAC"] },
    ],
    genres: ["Electronic"],
    styles: ["Ambient"],
    identifiers: [
      { type: "Matrix / Runout", value: "ABC-123-A" },
      { type: "Rights Society", value: "JASRAC" },
    ],
    tracklist: [{ position: "A1", title: "夜明け" }],
  }));

  assert.equal(metadata.release.title, "東京 Café / Niño");
  assert.equal(metadata.release.artists[1].name, "Björk");
  assert.deepEqual(metadata.release.releaseDate, { value: "2023-08", precision: "month" });
  assert.equal(metadata.release.labels.length, 2);
  assert.equal(metadata.release.catalogNumbers.length, 2);
  assert.equal(metadata.release.formats[0].quantity, 2);
  assert.equal(metadata.release.identifiers[0].type, "Matrix");
  assert.equal(metadata.release.identifiers[1].type, "Rights Society");
});

test("falls back to year precision and does not require barcode", () => {
  const metadata = normalizeDiscogsRelease(source({
    id: 102,
    title: "No Barcode Album",
    artists: [{ name: "Artist" }],
    year: 1999,
    labels: [{ name: "No Barcode Label", catno: "none" }],
    formats: [{ name: "Cassette", qty: "1" }],
    genres: [],
    styles: [],
    identifiers: [],
    tracklist: [],
  }));

  assert.deepEqual(metadata.release.releaseDate, { value: "1999", precision: "year" });
  assert.equal(metadata.release.catalogNumbers.length, 0);
  assert.equal(metadata.release.identifiers.length, 0);
  assert.equal(metadata.confidence["release.identifiers"], "medium");
});

test("normalizes Discogs master metadata as album-level source without release-specific fields", () => {
  const metadata = normalizeDiscogsRelease(masterSource({
    id: 1541661,
    title: "Trapped In Da 100",
    artists: [{ name: "KirbLaGoop" }],
    year: 2019,
    genres: ["Hip Hop"],
    styles: ["Cloud Rap"],
    labels: [{ name: "Should Not Import", catno: "NOPE-1" }],
    formats: [{ name: "File", qty: "1" }],
    identifiers: [{ type: "Barcode", value: "1234567890123" }],
    country: "US",
    tracklist: [{ position: "1", title: "Intro" }],
    uri: "https://www.discogs.com/master/1541661-KirbLaGoop-Trapped-In-Da-100",
  }));

  assert.equal(metadata.source.sourceType, "master");
  assert.equal(metadata.source.id, "1541661");
  assert.equal(metadata.release.title, "Trapped In Da 100");
  assert.deepEqual(metadata.release.releaseDate, { value: "2019", precision: "year" });
  assert.equal(metadata.release.labels.length, 0);
  assert.equal(metadata.release.formats.length, 0);
  assert.equal(metadata.release.identifiers.length, 0);
  assert.equal(metadata.release.catalogNumbers.length, 0);
  assert.equal(metadata.release.country, undefined);
  assert.equal(metadata.release.externalUrls[0].url, "https://www.discogs.com/master/1541661-KirbLaGoop-Trapped-In-Da-100");
  assert.ok(metadata.warnings.some((warning) => warning.field === "source.sourceType"));
  assert.ok(metadata.warnings.some((warning) => warning.field === "release.labels"));
});
