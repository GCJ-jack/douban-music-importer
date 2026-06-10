import assert from "node:assert/strict";
import test from "node:test";

import { extractBandcampCurrentPage } from "../src/core/bandcamp/bandcamp-current-page-extractor.js";
import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import { normalizeBandcampAlbumExtract } from "../src/core/normalizers/bandcamp-album-normalizer.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  markDraftFieldConfirmed,
} from "../src/core/review/draft-review-state.js";
import { validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../src/core/validation/schema-validation.js";
import {
  DARK_ANGELS_JSON_LD,
  DARK_ANGELS_SOURCE_URL,
  DARK_ANGELS_TRACKS,
} from "./fixtures/bandcamp-dark-angels-fixture.js";

test("extracts Dark Angels from Bandcamp MusicAlbum JSON-LD without hosting-account artist pollution", () => {
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      jsonLd: {
        ...DARK_ANGELS_JSON_LD,
        comment: [{ text: "private comment", author: { name: "private user" } }],
        sponsor: [{ name: "private sponsor" }],
        offers: { price: "9.99", url: "https://example.invalid/buy" },
        image: "https://example.invalid/cover.jpg",
        audio: { contentUrl: "https://example.invalid/audio.mp3" },
      },
      title: "Wrong DOM Title",
      artist: "Wrong DOM Artist",
      credits: "released January 1, 2000",
      tracks: ["1 Wrong DOM Track"],
      tags: ["wrong-dom-tag"],
      recommendations: ["Recommended Album by Recommended Artist"],
      hostingAccount: "XUM",
    }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract, {
    ok: true,
    provider: "bandcamp",
    sourceType: "album",
    sourceMode: "currentPage",
    sourceUrl: DARK_ANGELS_SOURCE_URL,
    title: "Dark Angels",
    artist: "SpaceGhostPurrp",
    releaseDate: "2023-11-20",
    tracks: DARK_ANGELS_TRACKS,
    tags: DARK_ANGELS_JSON_LD.keywords,
    hostingPublishers: ["XUM"],
    formats: [],
    coverVisible: false,
    warnings: [],
  });
  assert.notEqual(response.extract.artist, "XUM");
  assert.equal(JSON.stringify(response.extract).includes("private"), false);
  assert.equal(JSON.stringify(response.extract).includes("9.99"), false);
  assert.equal(JSON.stringify(response.extract).includes("example.invalid"), false);
  assert.equal(JSON.stringify(response.extract).includes("Recommended"), false);
});

test("extracts Dark Angels from restricted Bandcamp DOM fallback selectors", () => {
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      title: "Dark Angels",
      artist: "SpaceGhostPurrp",
      credits: "released November 20, 2023",
      tracks: DARK_ANGELS_TRACKS,
      tags: ["hip-hop/rap", "dark trap"],
      recommendations: ["Dark Angels", "SpaceGhostPurrp", "Other Album", "Other Artist"],
      hostingAccount: "XUM",
    }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Dark Angels");
  assert.equal(response.extract.artist, "SpaceGhostPurrp");
  assert.equal(response.extract.releaseDate, "2023-11-20");
  assert.equal(response.extract.sourceUrl, DARK_ANGELS_SOURCE_URL);
  assert.deepEqual(response.extract.tracks, DARK_ANGELS_TRACKS);
  assert.deepEqual(response.extract.tags, ["hip-hop/rap", "dark trap"]);
  assert.deepEqual(response.extract.hostingPublishers, []);
  assert.equal(response.extract.tracks[4], "5 Munnie Train (ft. Dough2x)");
  assert.equal(response.extract.tracks[11], "12 Terror Gang (ft. Kane Grocerys, Black Kray, Pollari, Fauni & Mista Splurge)");
  assert.notEqual(response.extract.artist, "XUM");
  assert.equal(JSON.stringify(response.extract).includes("Other Album"), false);
});

test("selects only the MusicAlbum JSON-LD matching the explicit current album URL", () => {
  const recommendationUrl = "https://xumstudios.bandcamp.com/album/recommended-album";
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      jsonLdScripts: [[
        {
          ...DARK_ANGELS_JSON_LD,
          "@id": recommendationUrl,
          mainEntityOfPage: recommendationUrl,
          name: "Recommended Album",
          byArtist: { name: "Recommended Artist" },
        },
        DARK_ANGELS_JSON_LD,
      ]],
    }),
    location: { href: `${DARK_ANGELS_SOURCE_URL}/?from=footer#tracks` },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Dark Angels");
  assert.equal(response.extract.artist, "SpaceGhostPurrp");
  assert.equal(response.extract.sourceUrl, DARK_ANGELS_SOURCE_URL);
  assert.equal(JSON.stringify(response.extract).includes("Recommended"), false);
});

test("uses restricted DOM fallback when all MusicAlbum JSON-LD URLs mismatch the current page", () => {
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      jsonLdScripts: [{
        ...DARK_ANGELS_JSON_LD,
        "@id": "https://xumstudios.bandcamp.com/album/recommended-album",
        mainEntityOfPage: "https://xumstudios.bandcamp.com/album/recommended-album",
        name: "Recommended Album",
        byArtist: { name: "Recommended Artist" },
      }],
      title: "Dark Angels",
      artist: "SpaceGhostPurrp",
      credits: "released November 20, 2023",
      tracks: DARK_ANGELS_TRACKS,
      tags: ["dark trap"],
    }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Dark Angels");
  assert.equal(response.extract.artist, "SpaceGhostPurrp");
  assert.deepEqual(response.extract.tracks, DARK_ANGELS_TRACKS);
  assert.deepEqual(response.extract.hostingPublishers, []);
  assert.equal(JSON.stringify(response.extract).includes("Recommended"), false);
});

test("continues after malformed JSON-LD and reads matching JSON-LD or restricted DOM fallback", () => {
  const validResponse = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      jsonLdScripts: ["{ malformed", DARK_ANGELS_JSON_LD],
    }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });
  assert.equal(validResponse.ok, true);
  assert.equal(validResponse.extract.title, "Dark Angels");

  const fallbackResponse = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      jsonLdScripts: ["{ malformed"],
      title: "Dark Angels",
      artist: "SpaceGhostPurrp",
      credits: "released November 20, 2023",
      tracks: DARK_ANGELS_TRACKS,
    }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });
  assert.equal(fallbackResponse.ok, true);
  assert.equal(fallbackResponse.extract.artist, "SpaceGhostPurrp");
  assert.deepEqual(fallbackResponse.extract.tracks, DARK_ANGELS_TRACKS);
});

test("uses restricted DOM fallback for each field missing from matching MusicAlbum JSON-LD", () => {
  for (const field of ["name", "byArtist", "datePublished", "track"]) {
    const jsonLd = { ...DARK_ANGELS_JSON_LD };
    delete jsonLd[field];
    const response = extractBandcampCurrentPage({
      document: fakeBandcampDocument({
        jsonLd,
        title: "Dark Angels",
        artist: "SpaceGhostPurrp",
        credits: "released November 20, 2023",
        tracks: DARK_ANGELS_TRACKS,
        recommendations: ["Recommended Artist"],
        hostingAccount: "XUM",
      }),
      location: { href: DARK_ANGELS_SOURCE_URL },
    });

    assert.equal(response.ok, true, field);
    assert.equal(response.extract.title, "Dark Angels", field);
    assert.equal(response.extract.artist, "SpaceGhostPurrp", field);
    assert.equal(response.extract.releaseDate, "2023-11-20", field);
    assert.deepEqual(response.extract.tracks, DARK_ANGELS_TRACKS, field);
    assert.notEqual(response.extract.artist, "XUM", field);
    assert.equal(JSON.stringify(response.extract).includes("Recommended Artist"), false, field);
  }
});

test("preserves duplicate legal track titles at different positions", () => {
  const duplicateTitleJsonLd = {
    ...DARK_ANGELS_JSON_LD,
    track: {
      "@type": "ItemList",
      itemListElement: [
        { position: 1, item: { name: "Same Title" } },
        { position: 2, item: { name: "Same Title" } },
      ],
    },
  };
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({ jsonLd: duplicateTitleJsonLd }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });

  assert.deepEqual(response.extract.tracks, ["1 Same Title", "2 Same Title"]);
});

test("normalizes Bandcamp review-only data and limits confirmed safe-fill fields", () => {
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({ jsonLd: DARK_ANGELS_JSON_LD }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });
  const { metadata, draft, fillPayload } = pipeline(response.extract);

  assert.deepEqual(validateAlbumReleaseMetadata(metadata), { ok: true, errors: [] });
  assert.deepEqual(validateDoubanMusicDraft(draft), { ok: true, errors: [] });
  assert.equal(metadata.source.provider, "bandcamp");
  assert.equal(metadata.source.sourceType, "album");
  assert.equal(metadata.source.sourceMode, "currentPage");
  assert.deepEqual(metadata.release.labels, []);
  assert.deepEqual(metadata.release.reviewOnly.labels, ["XUM"]);
  assert.deepEqual(metadata.release.reviewOnly.genres, DARK_ANGELS_JSON_LD.keywords);
  assert.equal(draft.fields.publisher, undefined);
  assert.equal(draft.fields.genre, undefined);
  assert.equal(draft.fields.media, undefined);
  assert.equal(draft.fields.coverImageUrl, undefined);
  assert.ok(draft.unmapped.some((item) => item.sourceField === "release.reviewOnly.labels" && item.value.includes("XUM")));
  assert.ok(draft.unmapped.some((item) => item.sourceField === "release.reviewOnly.genres"));
  assert.ok(draft.unmapped.some((item) =>
    item.sourceField === "release.reviewOnly.labels" &&
    item.reason === "Bandcamp hosting publisher is review-only and must not auto-fill Douban publisher."
  ));
  assert.ok(draft.unmapped.some((item) =>
    item.sourceField === "release.reviewOnly.genres" &&
    item.reason === "Bandcamp tags/genres are review-only and must not auto-fill Douban custom selects."
  ));
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "tracks", "externalLinks"]);
});

test("rejects non-album and unsupported Bandcamp pages", () => {
  for (const url of [
    "https://xumstudios.bandcamp.com/track/bloody-mary",
    "https://xumstudios.bandcamp.com/music",
    "https://example.com/album/dark-angels",
  ]) {
    const response = extractBandcampCurrentPage({
      document: fakeBandcampDocument({ jsonLd: DARK_ANGELS_JSON_LD }),
      location: { href: url },
    });
    assert.equal(response.ok, false);
    assert.equal(response.code, "unsupported_bandcamp_page");
  }
});

test("rejects Bandcamp album URLs without trusted album metadata", () => {
  const response = extractBandcampCurrentPage({
    document: fakeBandcampDocument({
      recommendations: ["Dark Angels", "SpaceGhostPurrp"],
      hostingAccount: "XUM",
    }),
    location: { href: DARK_ANGELS_SOURCE_URL },
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "unsupported_bandcamp_dom");
});

function pipeline(extract) {
  const metadata = normalizeBandcampAlbumExtract({
    provider: "bandcamp",
    sourceType: "album",
    sourceMode: "currentPage",
    pageUrl: extract.sourceUrl,
    extractorVersion: "0.1.0-prototype",
    fetchedAt: "2026-06-07T00:00:00.000Z",
    warnings: extract.warnings,
    raw: extract,
  });
  const draft = mapReleaseToDoubanDraft(metadata);
  let reviewState = createDraftReviewState({
    draft,
    sourceSummary: { provider: "bandcamp", sourceType: "album", sourceMode: "currentPage" },
    warnings: metadata.warnings,
    validation: {},
    now: "2026-06-07T00:00:00.000Z",
  });
  for (const fieldName of Object.keys(draft.fields)) {
    reviewState = markDraftFieldConfirmed(reviewState, fieldName);
  }
  return { metadata, draft, fillPayload: getFillableDraftFields(reviewState) };
}

function fakeBandcampDocument(options = {}) {
  const trackRows = (options.tracks || []).map((track) => {
    const [position, ...title] = track.split(" ");
    return fakeNode(`${position} ${title.join(" ")} 4:00 buy track`, {}, {
      ".track_number": [fakeNode(position)],
      ".track-title": [fakeNode(title.join(" "))],
    });
  });
  const jsonLdScripts = options.jsonLdScripts || (options.jsonLd ? [options.jsonLd] : []);
  const selectors = {
    "script[type='application/ld+json']": jsonLdScripts.map((value) =>
      fakeNode(typeof value === "string" ? value : JSON.stringify(value))
    ),
    "meta[property='og:url']": [fakeNode("", { content: DARK_ANGELS_SOURCE_URL })],
    "#name-section .trackTitle": options.title ? [fakeNode(options.title)] : [],
    "#name-section h3 a": options.artist ? [fakeNode(options.artist)] : [],
    ".tralbum-credits": options.credits ? [fakeNode(options.credits)] : [],
    "#track_table tr.track_row_view": trackRows,
    ".tralbum-tags a.tag": (options.tags || []).map((tag) => fakeNode(tag)),
    "#band-name-location": options.hostingAccount ? [fakeNode(options.hostingAccount)] : [],
    ".recommended-album, .recommended-artist, footer a": (options.recommendations || []).map((value) => fakeNode(value)),
    ".buyItem, .download-link, .inline_player, .supporters, .comments, .merch-grid": [
      fakeNode("private user price audio download merch"),
    ],
  };
  return fakeNode("", {}, selectors);
}

function fakeNode(textContent = "", attributes = {}, selectors = {}) {
  return {
    textContent,
    getAttribute(name) {
      return attributes[name] || "";
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      return selectors[selector] || [];
    },
  };
}
