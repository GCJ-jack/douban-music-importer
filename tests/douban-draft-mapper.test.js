import assert from "node:assert/strict";
import test from "node:test";

import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import { normalizeDiscogsRelease } from "../src/core/normalizers/discogs-release-normalizer.js";

function normalize(raw) {
  return normalizeDiscogsRelease({
    provider: "discogs",
    sourceType: "release",
    releaseId: String(raw.id || 200),
    apiUrl: `https://api.discogs.com/releases/${raw.id || 200}`,
    pageUrl: raw.uri || `https://www.discogs.com/release/${raw.id || 200}-Fixture`,
    fetchedAt: "2026-05-10T00:00:00.000Z",
    extractorVersion: "0.1.0",
    raw,
  });
}

test("maps high-priority release fields to Douban draft fields", () => {
  const draft = mapReleaseToDoubanDraft(normalize({
    id: 200,
    title: "Draft Album",
    artists: [{ name: "Draft Artist" }],
    released: "2024-05-01",
    labels: [{ name: "Draft Label", catno: "DR-200" }],
    formats: [{ name: "CD", qty: "1" }],
    genres: ["Pop"],
    styles: ["Synth-pop"],
    identifiers: [{ type: "Barcode", value: "9876543210000" }],
    tracklist: [
      { position: "1", title: "Intro" },
      { position: "2", title: "Single" },
    ],
    notes: "Limited release notes.",
    images: [{ type: "primary", uri: "https://img.discogs.com/draft.jpg" }],
    uri: "https://www.discogs.com/release/200-Draft-Album",
  }));

  assert.equal(draft.schemaVersion, "0.1");
  assert.equal(draft.fields.title.value, "Draft Album");
  assert.equal(draft.fields.artists.value, "Draft Artist");
  assert.equal(draft.fields.releaseDate.value, "2024-05-01");
  assert.equal(draft.fields.publisher.value, "Draft Label");
  assert.equal(draft.fields.media.value, "CD");
  assert.equal(draft.fields.genre.value, "Pop; Synth-pop");
  assert.equal(draft.fields.genre.needsReview, true);
  assert.equal(draft.fields.barcode.value, "9876543210000");
  assert.equal(draft.fields.catalogNumber.value, "Draft Label: DR-200");
  assert.equal(draft.fields.tracks.value, "1 Intro\n2 Single");
  assert.equal(draft.fields.summary.needsReview, true);
  assert.equal(draft.fields.coverImageUrl.needsReview, true);
  assert.match(draft.fields.externalLinks.value, /discogs\.com\/release\/200/);
});

test("marks lossy multi-value mappings as needsReview", () => {
  const draft = mapReleaseToDoubanDraft(normalize({
    id: 201,
    title: "Multi Album",
    artists: [
      { name: "Artist A", join: " & " },
      { name: "Artist B" },
    ],
    released: "2023",
    labels: [
      { name: "Label A", catno: "A-1" },
      { name: "Label B", catno: "B-1" },
    ],
    formats: [{ name: "Vinyl", qty: "2", descriptions: ["LP", "Album"] }],
    genres: ["Jazz"],
    styles: [],
    identifiers: [],
    tracklist: [
      {
        position: "A",
        title: "Suite",
        sub_tracks: [{ position: "A1", title: "Part One" }],
      },
    ],
  }));

  assert.equal(draft.fields.artists.value, "Artist A & Artist B");
  assert.equal(draft.fields.artists.needsReview, true);
  assert.equal(draft.fields.releaseDate.needsReview, true);
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.equal(draft.fields.media.needsReview, true);
  assert.equal(draft.fields.catalogNumber.needsReview, true);
  assert.equal(draft.fields.tracks.needsReview, true);
  assert.equal(draft.fields.tracks.value, "A Suite\nA1 Part One");
});

test("preserves medium-priority fields as unmapped where practical", () => {
  const draft = mapReleaseToDoubanDraft(normalize({
    id: 202,
    title: "Unmapped Album",
    artists: [{ name: "Artist" }],
    year: 2022,
    country: "Japan",
    labels: [{ name: "Label", catno: "CAT-202" }],
    companies: [{ name: "Pressed By Company", entity_type_name: "Pressed By" }],
    formats: [{ name: "CD", qty: "1" }],
    genres: [],
    styles: [],
    identifiers: [{ type: "Matrix / Runout", value: "MATRIX-202" }],
    extraartists: [{ name: "Producer Name", role: "Producer" }],
    tracklist: [],
  }));

  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.country"));
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.companies"));
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.identifiers"));
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.credits"));
});
