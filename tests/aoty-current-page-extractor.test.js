import assert from "node:assert/strict";
import test from "node:test";

import { extractAotyCurrentPage } from "../src/core/aoty/aoty-current-page-extractor.js";
import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import { normalizeAotyAlbumPaste } from "../src/core/normalizers/aoty-album-normalizer.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  markDraftFieldConfirmed,
} from "../src/core/review/draft-review-state.js";
import { validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../src/core/validation/schema-validation.js";

const SOURCE_URL = "https://www.albumoftheyear.org/album/1998-kanye-west-my-beautiful-dark-twisted-fantasy.php";
const KANYE_TRACKS = [
  "1 Dark Fantasy",
  "2 Gorgeous",
  "3 POWER",
  "4 All of the Lights",
  "5 All of the Lights",
  "6 Monster",
  "7 So Appalled",
  "8 Devil in a New Dress",
  "9 Runaway",
  "10 Hell of a Life",
  "11 Blame Game",
  "12 Lost in the World",
  "13 Who Will Survive in America",
];

test("extracts standard AOTY album JSON-LD and track table from current page", () => {
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "MusicAlbum",
        "@id": SOURCE_URL,
        url: SOURCE_URL,
        name: "My Beautiful Dark Twisted Fantasy",
        byArtist: { "@type": "MusicGroup", name: "Kanye West" },
        datePublished: "2010-11-22",
        genre: ["Pop Rap", "Hip Hop"],
        aggregateRating: { ratingValue: "94" },
      },
      canonical: SOURCE_URL,
      title: "Wrong DOM fallback",
      artist: "Wrong Artist",
      details: [
        ["Format", "LP"],
        ["Label", "Def Jam, Roc-A-Fella"],
        ["Secondary Genres", "Art Pop, Experimental Hip Hop"],
      ],
      tracks: KANYE_TRACKS,
      coverVisible: true,
    }),
    location: { href: SOURCE_URL },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.provider, "aoty");
  assert.equal(response.extract.sourceType, "album");
  assert.equal(response.extract.sourceMode, "currentPage");
  assert.equal(response.extract.sourceUrl, SOURCE_URL);
  assert.equal(response.extract.sourceId, "1998");
  assert.equal(response.extract.title, "My Beautiful Dark Twisted Fantasy");
  assert.equal(response.extract.artist, "Kanye West");
  assert.equal(response.extract.releaseDate, "2010-11-22");
  assert.deepEqual(response.extract.tracks, KANYE_TRACKS);
  assert.deepEqual(response.extract.genres, ["Pop Rap", "Hip Hop", "Art Pop", "Experimental Hip Hop"]);
  assert.deepEqual(response.extract.labels, ["Def Jam", "Roc-A-Fella"]);
  assert.deepEqual(response.extract.formats, ["LP"]);
  assert.equal(response.extract.coverVisible, true);

  const { metadata, draft, unconfirmedFillPayload, fillPayload } = pipeline(response.extract);
  assert.deepEqual(validateAlbumReleaseMetadata(metadata), { ok: true, errors: [] });
  assert.deepEqual(validateDoubanMusicDraft(draft), { ok: true, errors: [] });
  assert.equal(metadata.source.provider, "aoty");
  assert.equal(metadata.source.sourceType, "album");
  assert.equal(metadata.source.sourceMode, "currentPage");
  assert.equal(draft.attribution, "Metadata extracted from the current Album of the Year album page. Please review before submitting to Douban.");
  assert.equal(draft.fields.title.value, "My Beautiful Dark Twisted Fantasy");
  assert.equal(draft.fields.artists.value, "Kanye West");
  assert.equal(draft.fields.releaseDate.value, "2010-11-22");
  assert.equal(draft.fields.publisher.value, "Def Jam; Roc-A-Fella");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.equal(draft.fields.publisher.confidence, "medium");
  assert.equal(draft.fields.tracks.value, KANYE_TRACKS.join("\n"));
  assert.equal(unconfirmedFillPayload.publisher, undefined);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "tracks", "externalLinks"]);
  assertSafeFillBoundary(draft, fillPayload);
});

test("extracts sparse noisy AOTY album page without tracklist", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/1792171-vince-staples-cry-baby.php";
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({
      canonical: sourceUrl,
      title: "Cry Baby",
      artist: "Vince Staples",
      details: [
        ["Release Date", "Jun 5, 2026"],
        ["Genre", "-"],
        ["Format", "LP"],
        ["Label", "Loma Vista"],
        ["Critic Score", "NR"],
        ["User Score", "NR"],
        ["Purchasing Cry Baby", "Amazon Apple Music Bandcamp Vinyl"],
      ],
      tracks: [],
    }),
    location: { href: sourceUrl },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.sourceId, "1792171");
  assert.equal(response.extract.title, "Cry Baby");
  assert.equal(response.extract.artist, "Vince Staples");
  assert.equal(response.extract.releaseDate, "2026-06-05");
  assert.deepEqual(response.extract.tracks, []);
  assert.deepEqual(response.extract.genres, []);
  assert.deepEqual(response.extract.labels, ["Loma Vista"]);
  assert.deepEqual(response.extract.formats, ["LP"]);
  assert.ok(response.warnings.some((warning) => warning.field === "release.tracklist"));

  const { draft, fillPayload } = pipeline(response.extract);
  assert.equal(draft.fields.tracks, undefined);
  assert.equal(draft.fields.publisher.value, "Loma Vista");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "externalLinks"]);
  assertSafeFillBoundary(draft, fillPayload);
});

test("extracts Chinese AOTY details labels as review-only unmapped fields", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/335317-boards-of-canada-music-has-the-right-to-children.php";
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({
      canonical: sourceUrl,
      title: "Music Has the Right to Children",
      artist: "Boards of Canada",
      details: [
        ["2026年6月5日 /发布日期"],
        ["LP /格式"],
        ["Warp，Music70 /厂牌"],
        ["Downtempo，IDM /类型"],
      ],
      tracks: ["1 Wildlife Analysis", "2 An Eagle in Your Mind"],
    }),
    location: { href: sourceUrl },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.releaseDate, "2026-06-05");
  assert.deepEqual(response.extract.formats, ["LP"]);
  assert.deepEqual(response.extract.labels, ["Warp", "Music70"]);
  assert.deepEqual(response.extract.genres, ["Downtempo", "IDM"]);

  const { metadata, draft, fillPayload } = pipeline(response.extract);
  assert.deepEqual(metadata.release.reviewOnly.formats, ["LP"]);
  assert.deepEqual(metadata.release.labels, [{ name: "Warp" }, { name: "Music70" }]);
  assert.deepEqual(metadata.release.reviewOnly.labels, []);
  assert.deepEqual(metadata.release.reviewOnly.genres, ["Downtempo", "IDM"]);
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.reviewOnly.formats" && field.value.includes("LP")));
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.reviewOnly.genres" && field.value.includes("Downtempo") && field.value.includes("IDM")));
  assert.equal(draft.fields.publisher.value, "Warp; Music70");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "tracks", "externalLinks"]);
  assertSafeFillBoundary(draft, fillPayload);
});

test("extracts combined Chinese AOTY details container as review-only unmapped fields", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/1786950-boards-of-canada-inferno.php";
  const tracks = Array.from({ length: 18 }, (_, index) => `${index + 1} Track ${index + 1}`);
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({
      canonical: sourceUrl,
      title: "Inferno",
      artist: "Boards of Canada",
      detailText: [
        "2026年5月29日 /发布日期 LP /格式 Warp，Music70 /厂牌 Downtempo，IDM /类型 周围的，幽灵学，新迷幻，渐进电子，合成波 / 类型",
      ],
      tracks,
    }),
    location: { href: sourceUrl },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.title, "Inferno");
  assert.equal(response.extract.artist, "Boards of Canada");
  assert.equal(response.extract.releaseDate, "2026-05-29");
  assert.equal(response.extract.tracks.length, 18);
  assert.deepEqual(response.extract.formats, ["LP"]);
  assert.deepEqual(response.extract.labels, ["Warp", "Music70"]);
  assert.deepEqual(response.extract.genres, ["Downtempo", "IDM", "周围的", "幽灵学", "新迷幻", "渐进电子", "合成波"]);

  const { metadata, draft, fillPayload } = pipeline(response.extract);
  assert.deepEqual(metadata.release.reviewOnly.formats, ["LP"]);
  assert.deepEqual(metadata.release.labels, [{ name: "Warp" }, { name: "Music70" }]);
  assert.deepEqual(metadata.release.reviewOnly.labels, []);
  assert.deepEqual(metadata.release.reviewOnly.genres, ["Downtempo", "IDM", "周围的", "幽灵学", "新迷幻", "渐进电子", "合成波"]);
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.reviewOnly.formats" && field.value.includes("LP")));
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.reviewOnly.genres" && field.value.includes("Downtempo") && field.value.includes("合成波")));
  assert.equal(draft.fields.publisher.value, "Warp; Music70");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "tracks", "externalLinks"]);
  assertSafeFillBoundary(draft, fillPayload);
});

test("builds current-page review state publisher from Inferno body details fallback", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/1786950-boards-of-canada-inferno.php";
  const tracks = Array.from({ length: 18 }, (_, index) => `${index + 1} Track ${index + 1}`);
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({
      canonical: sourceUrl,
      title: "Inferno",
      artist: "Boards of Canada",
      bodyText: [
        "Inferno Boards of Canada",
        "2026年 5月29日 / 发布日期",
        "LP / Format",
        "Warp，Music70 /厂牌",
        "Downtempo，IDM /类型",
        "周围的，幽灵学，新迷幻，渐进电子，合成波 / 类型",
        "Critic Score User Score Comments More Albums",
      ].join("\n"),
      tracks,
    }),
    location: { href: sourceUrl },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.labels, ["Warp", "Music70"]);
  assert.deepEqual(response.extract.formats, ["LP"]);

  const { metadata, draft, unconfirmedFillPayload, fillPayload } = pipeline(response.extract, {
    confirmFields: ["title", "artists", "releaseDate", "tracks", "externalLinks"],
  });
  assert.deepEqual(metadata.release.labels, [{ name: "Warp" }, { name: "Music70" }]);
  assert.deepEqual(metadata.release.reviewOnly.formats, ["LP"]);
  assert.deepEqual(metadata.provenance["release.labels"], ["raw.labels"]);
  assert.equal(draft.fields.publisher.value, "Warp; Music70");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.equal(draft.fields.publisher.confidence, "medium");
  assert.deepEqual(draft.fields.publisher.sourceFields, ["release.labels"]);
  assert.equal(unconfirmedFillPayload.publisher, undefined);
  assert.equal(fillPayload.publisher, undefined);
  assert.ok(draft.unmapped.some((field) => field.sourceField === "release.reviewOnly.formats" && field.value.includes("LP")));
  assert.equal(draft.fields.media, undefined);
  assert.equal(fillPayload.media, undefined);

  let reviewState = createDraftReviewState({
    draft,
    sourceSummary: { provider: "aoty", sourceType: "album", sourceMode: "currentPage" },
    warnings: metadata.warnings,
    validation: {},
    now: "2026-05-31T00:00:00.000Z",
  });
  reviewState = markDraftFieldConfirmed(reviewState, "publisher");
  assert.equal(getFillableDraftFields(reviewState).publisher.value, "Warp; Music70");
  assertSafeFillBoundary(draft, getFillableDraftFields(reviewState));
});

test("rejects unsupported non-AOTY pages", () => {
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({ title: "Album", artist: "Artist" }),
    location: { href: "https://rateyourmusic.com/release/album/artist/title/" },
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "unsupported_aoty_page");
  assert.equal(response.page.reason, "unsupported_host");
});

test("rejects AOTY album URLs without supported album DOM", () => {
  const response = extractAotyCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1.albumTitle": [fakeNode("AOTY Chart")],
      },
    }),
    location: { href: SOURCE_URL },
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "unsupported_aoty_dom");
  assert.equal(response.extract, null);
});

test("filters AOTY scores, reviews, comments, purchase links, and user data from tracks and safe-fill", () => {
  const response = extractAotyCurrentPage({
    document: fakeAotyDocument({
      canonical: SOURCE_URL,
      title: "My Beautiful Dark Twisted Fantasy",
      artist: "Kanye West",
      details: [["Release Date", "Nov 22, 2010"]],
      tracks: [
        "1 Dark Fantasy",
        "2 Gorgeous",
      ],
      noisyTrackCells: [
        ["4:40", "94", "feat. Example", "Producer Kanye West"],
        ["5:57", "91", "User Reviews Comments", "Amazon Apple Music Vinyl"],
      ],
      extraNoise: [
        "Critic Score 94",
        "User Score 91",
        "Popular User Reviews",
        "Comments user123",
        "Year End Lists",
        "Purchasing My Beautiful Dark Twisted Fantasy",
      ],
    }),
    location: { href: SOURCE_URL },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, ["1 Dark Fantasy", "2 Gorgeous"]);

  const { draft, fillPayload } = pipeline(response.extract);
  assert.equal(/94|91|feat|Producer|Reviews|Comments|Amazon|Apple Music|Vinyl/.test(draft.fields.tracks.value), false);
  assertSafeFillBoundary(draft, fillPayload);
});

function pipeline(extract, options = {}) {
  const metadata = normalizeAotyAlbumPaste({
    provider: "aoty",
    sourceType: "album",
    sourceMode: "currentPage",
    pageUrl: extract.sourceUrl,
    extractorVersion: "0.3.0-prototype",
    fetchedAt: "2026-05-31T00:00:00.000Z",
    warnings: extract.warnings || [],
    raw: extract,
  });
  const draft = mapReleaseToDoubanDraft(metadata);
  let reviewState = createDraftReviewState({
    draft,
    sourceSummary: { provider: "aoty", sourceType: "album", sourceMode: "currentPage" },
    warnings: metadata.warnings,
    validation: {},
    now: "2026-05-31T00:00:00.000Z",
  });
  for (const fieldName of options.confirmFields || Object.keys(draft.fields)) {
    reviewState = markDraftFieldConfirmed(reviewState, fieldName);
  }
  return {
    metadata,
    draft,
    reviewState,
    unconfirmedFillPayload: getFillableDraftFields(createDraftReviewState({
      draft,
      sourceSummary: { provider: "aoty", sourceType: "album", sourceMode: "currentPage" },
      warnings: metadata.warnings,
      validation: {},
      now: "2026-05-31T00:00:00.000Z",
    })),
    fillPayload: getFillableDraftFields(reviewState),
  };
}

function assertSafeFillBoundary(draft, fillPayload) {
  assert.equal(draft.fields.genre, undefined);
  assert.equal(draft.fields.media, undefined);
  assert.equal(draft.fields.coverImageUrl, undefined);
  assert.equal(draft.fields.barcode, undefined);
  assert.equal(draft.fields.catalogNumber, undefined);
  assert.equal(fillPayload.genre, undefined);
  assert.equal(fillPayload.media, undefined);
  assert.equal(fillPayload.coverImageUrl, undefined);
  assert.equal(fillPayload.barcode, undefined);
  assert.equal(fillPayload.catalogNumber, undefined);
}

function fakeAotyDocument(options = {}) {
  const detailRows = (options.details || []).map(([label, value]) => fakeRow([label, value]));
  const detailTextRows = (options.detailText || []).map((value) => fakeNode(value));
  const trackRows = (options.tracks || []).map((track, index) => {
    const [position, ...titleParts] = track.split(" ");
    const noise = options.noisyTrackCells?.[index] || ["4:40", "94", "feat. Example", "Producer Example"];
    return fakeTrackRow(position, titleParts.join(" "), noise);
  });
  const selectors = {
    "script[type='application/ld+json'], script[type=\"application/ld+json\"]": options.jsonLd ? [fakeNode(JSON.stringify(options.jsonLd))] : [],
    "link[rel='canonical'], link[rel=\"canonical\"]": options.canonical ? [fakeNode("", { href: options.canonical })] : [],
    "meta[property='og:url'], meta[property=\"og:url\"]": options.canonical ? [fakeNode("", { content: options.canonical })] : [],
    "meta[property='og:title'], meta[property=\"og:title\"]": options.title ? [fakeNode(`${options.title} - Album of the Year`, { content: `${options.title} - Album of the Year` })] : [],
    ".albumHeadline h1.albumTitle": options.title ? [fakeNode(options.title)] : [],
    "h1.albumTitle": options.title ? [fakeNode(options.title)] : [],
    ".albumHeadline .artist": options.artist ? [fakeNode(options.artist)] : [],
    ".albumHeadline a[href*='/artist/']": options.artist ? [fakeNode(options.artist)] : [],
    "a[href*='/artist/']": options.artist ? [fakeNode(options.artist)] : [],
    ".details tr": detailRows,
    ".details div": detailTextRows,
    "#tracklist .trackListTable tr": trackRows,
    ".albumArt, .albumCover, [class*='cover'], img[alt*='cover'], meta[property='og:image']": options.coverVisible ? [fakeNode("cover")] : [],
  };
  if (options.extraNoise) {
    selectors[".albumReviewRow"] = options.extraNoise.map((value) => fakeNode(value));
  }
  return fakeDocument({ selectors, bodyText: options.bodyText });
}

function fakeDocument({ selectors = {}, bodyText = "" } = {}) {
  return {
    ...fakeNode("", {}, selectors),
    body: fakeNode(bodyText),
  };
}

function fakeTrackRow(position, title, noise = []) {
  return fakeNode([position, title, ...noise].join(" "), {}, {
    ".trackNumber": [fakeNode(position)],
    ".trackTitle > a": [fakeNode(title)],
    ".trackTitle a": [fakeNode(title)],
    ".trackTitle": [fakeNode(title)],
    ".length": [fakeNode(noise[0] || "")],
    ".trackRating": [fakeNode(noise[1] || "")],
    ".featuredArtists": [fakeNode(noise[2] || "")],
    ".trackNotes": [fakeNode(noise[3] || "")],
  });
}

function fakeRow(cells) {
  const cellNodes = cells.map((cell) => fakeNode(cell));
  return fakeNode(cells.join(" "), {}, {
    "th, td, .label, .value, span, a": cellNodes,
  });
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
