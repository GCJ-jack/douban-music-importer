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

test("supports RYM mixtape release pages and keeps release type review-only", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["BMB RVDIX by BMB Deathrow"],
        ".release_info tr": ["Released 2024"],
        ".tracklist tr": ["1. Intro", "2. Outro"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/mixtape/bmb-deathrow/bmb-rvdix/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.page.reason, "rym_release_page");
  assert.equal(response.page.releaseType, "mixtape");
  assert.equal(response.extract.releaseType, "mixtape");

  const metadata = normalizeRymAlbumExtract({
    raw: response.extract,
    pageUrl: response.extract.sourceUrl,
    fetchedAt: "2026-05-17T00:00:00.000Z",
  });
  assert.deepEqual(validateAlbumReleaseMetadata(metadata), { ok: true, errors: [] });
  assert.equal(metadata.release.releaseType, "mixtape");
  assert.deepEqual(metadata.provenance["release.releaseType"], ["raw.releaseType"]);
  assert.equal(metadata.warnings.some((warning) => warning.field === "release.releaseType"), true);

  const draft = mapReleaseToDoubanDraft(metadata);
  assert.deepEqual(validateDoubanMusicDraft(draft), { ok: true, errors: [] });
  assert.equal(draft.unmapped.some((field) => field.sourceField === "release.releaseType" && field.value === "mixtape"), true);
  assert.equal(draft.fields.media, undefined);

  let reviewState = createDraftReviewState({
    draft,
    sourceSummary: { provider: "rym", sourceType: "album" },
    warnings: metadata.warnings,
    validation: {},
    now: "2026-05-17T00:00:00.000Z",
  });
  for (const fieldName of ["title", "artists", "releaseDate", "tracks", "externalLinks"]) {
    reviewState = markDraftFieldConfirmed(reviewState, fieldName, {
      now: "2026-05-17T00:00:00.000Z",
    });
  }

  const fillPayload = getFillableDraftFields(reviewState);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "tracks", "externalLinks"]);
  assert.equal(fillPayload.releaseType, undefined);
  assert.equal(fillPayload.media, undefined);
});

test("cleans RYM lyrics link pollution and deduplicates standard album tracklist", () => {
  const tracks = [
    ["1", "Pink Diamond"],
    ["2", "Forever"],
    ["3", "Claws"],
    ["4", "7 Years"],
    ["5", "Detonate"],
    ["6", "Enemy"],
    ["7", "I Finally Understand"],
    ["8", "C2.0"],
    ["9", "Party 4 U"],
    ["10", "Anthems"],
    ["11", "Visions"],
  ];
  const trackRows = tracks.flatMap(([position, title]) => [
    fakeRow([position, `${title}lyrics`]),
    fakeRow([position, title]),
  ]);
  const document = fakeDocument({
    selectors: {
      "h1": ["How I'm Feeling Now"],
      "a[href*='/artist/']": ["Charli XCX"],
      ".release_info tr": ["Released 15 May 2020"],
      ".tracklist": [fakeContainer(trackRows)],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/album/charli-xcx/how-im-feeling-now/" },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, tracks.map(([position, title]) => `${position} ${title}`));
  assert.equal(response.extract.tracks.length, 11);
  assert.equal(response.extract.tracks.some((track) => /lyrics/i.test(track)), false);
});

test("reads RYM EP tracklist from sequence-only tracklist container", () => {
  const document = fakeDocument({
    selectors: {
      "h1": ["Legalize Nuclear Bombs by DJ Smokey"],
      ".release_info tr": ["Released 2014"],
      ".tracklist": [
        fakeContainerWithText([], [
          "1",
          "Intro",
          "1:20",
          "2",
          "Legalize Nuclear Bombs",
          "2:45",
          "3",
          "Outro",
          "1:58",
          "Saving...",
          "rymQ(function(){ track_ratings.init(); })",
          "track_ratings",
        ].join("\n")),
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/ep/dj-smokey/legalize-nuclear-bombs/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.releaseType, "ep");
  assert.deepEqual(response.extract.tracks, [
    "1 Intro",
    "2 Legalize Nuclear Bombs",
    "3 Outro",
  ]);
  assert.equal(response.extract.tracks.some((track) => /Saving|rymQ\(|track_ratings/i.test(track)), false);
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
      ".tracklist": [fakeContainer(trackRows)],
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

test("reads complete RYM main track listing in page order before credits fragments", () => {
  const tracks = Array.from({ length: 25 }, (_, index) => {
    const position = String(index + 1);
    return [position, `BMB Deathrow - Track ${position}`];
  });
  const mainRows = tracks.map(([position, title]) => fakeRow([position, title]));
  const creditsRows = tracks.slice(9, 14).map(([position, title]) => fakeRow([
    position,
    title,
    "producer DJ Example",
    "expanded credits",
    "track_ratings",
  ]));

  const document = fakeDocument({
    selectors: {
      "h1": ["BMB RVDIX by BMB Deathrow"],
      ".release_info tr": ["Released 2024"],
      ".tracklist": [fakeContainer(mainRows)],
      ".track_listing": [fakeContainer(creditsRows)],
      ".tracklist li": [
        "10 BMB Deathrow - Track 10",
        "11 BMB Deathrow - Track 11",
        "10 BMB Deathrow - Track 10 11 BMB Deathrow - Track 11",
        "Saving...",
        "rymQ(function(){ track_ratings.init(); })",
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/mixtape/bmb-deathrow/bmb-rvdix/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.tracks.length, 25);
  assert.deepEqual(response.extract.tracks, tracks.map(([position, title]) => `${position} ${title}`));
  assert.equal(response.extract.tracks[0], "1 BMB Deathrow - Track 1");
  assert.equal(response.extract.tracks[8], "9 BMB Deathrow - Track 9");
  assert.equal(response.extract.tracks[9], "10 BMB Deathrow - Track 10");
  assert.equal(response.extract.tracks[24], "25 BMB Deathrow - Track 25");
  assert.equal(response.extract.tracks.some((track) => /producer|expanded credits|track_ratings|Saving|rymQ\(/i.test(track)), false);
  assert.equal(response.extract.tracks.some((track) => track.includes("10 BMB Deathrow - Track 10 11")), false);
});

test("merges split RYM track listing containers before credits and fallback fragments", () => {
  const tracks = [
    ["1", "SpaceGhostPurrp aka Purrple Haze - King of Miami"],
    ["2", "BMB Deathrow - Track 2"],
    ["3", "BMB Deathrow - Track 3"],
    ["4", "BMB Deathrow - Track 4"],
    ["5", "BMB Deathrow - Track 5"],
    ["6", "BMB Deathrow - Track 6"],
    ["7", "BMB Deathrow - Track 7"],
    ["8", "BMB Deathrow - Track 8"],
    ["9", "Chxpo - Knock It Off"],
    ["10", "Slim Guerilla - Ice Cold Lady Pimp"],
    ["11", "BMB Deathrow - Track 11"],
    ["12", "BMB Deathrow - Track 12"],
    ["13", "BMB Deathrow - Track 13"],
    ["14", "BMB Deathrow - Track 14"],
    ["15", "BMB Deathrow - Track 15"],
    ["16", "BMB Deathrow - Track 16"],
    ["17", "BMB Deathrow - Track 17"],
    ["18", "BMB Deathrow - Track 18"],
    ["19", "BMB Deathrow - Track 19"],
    ["20", "BMB Deathrow - Track 20"],
    ["21", "BMB Deathrow - Track 21"],
    ["22", "BMB Deathrow - Track 22"],
    ["23", "BMB Deathrow - Track 23"],
    ["24", "BMB Deathrow - Track 24"],
    ["25", "SpaceGhostPurrp aka Purrple Haze - Life of a Scorpio Moon"],
  ];
  const firstContainer = fakeContainer(tracks.slice(0, 9).map(([position, title]) => fakeRow([position, title])));
  const secondContainer = fakeContainer(tracks.slice(9).map(([position, title]) => fakeRow([position, title])));
  const creditsContainer = fakeContainer(tracks.slice(9, 12).map(([position, title]) => fakeRow([
    position,
    title,
    "producer DJ Example",
    "expanded credits",
    "track_ratings",
  ])));

  const document = fakeDocument({
    selectors: {
      "h1": ["BMB RVDIX by BMB Deathrow"],
      ".release_info tr": ["Released 2024"],
      ".tracklist": [secondContainer, firstContainer],
      ".track_listing": [creditsContainer],
      ".tracklist li": [
        "10 Slim Guerilla - Ice Cold Lady Pimp",
        "11 BMB Deathrow - Track 11",
        "10 Slim Guerilla - Ice Cold Lady Pimp 11 BMB Deathrow - Track 11",
        "Saving...",
        "rymQ(function(){ track_ratings.init(); })",
      ],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/mixtape/bmb-deathrow/bmb-rvdix/" },
  });

  assert.equal(response.ok, true);
  assert.equal(response.extract.tracks.length, 25);
  assert.equal(response.extract.tracks[0], "1 SpaceGhostPurrp aka Purrple Haze - King of Miami");
  assert.equal(response.extract.tracks[8], "9 Chxpo - Knock It Off");
  assert.equal(response.extract.tracks[9], "10 Slim Guerilla - Ice Cold Lady Pimp");
  assert.equal(response.extract.tracks[24], "25 SpaceGhostPurrp aka Purrple Haze - Life of a Scorpio Moon");
  assert.deepEqual(response.extract.tracks, tracks.map(([position, title]) => `${position} ${title}`));
  assert.equal(response.extract.tracks.some((track) => /producer|expanded credits|track_ratings|Saving|rymQ\(/i.test(track)), false);
  assert.equal(response.extract.tracks.some((track) => track.includes("10 Slim Guerilla - Ice Cold Lady Pimp 11")), false);
});

test("recovers first RYM track when sequence text omits the leading 1 position", () => {
  const tracks = [
    ["1", "SpaceGhostPurrp aka Purrple Haze - King of Miami"],
    ["2", "Chxpo x SpaceGhostPurrp aka Purrple Haze - Way Past Savage"],
    ["3", "Chxpo x Black Kray - BMB2K16"],
    ["4", "SpaceGhostPurrp aka Purrple Haze - Boss Mobb RBMG"],
    ["5", "Chxpo x Black Kray - So Icey Goth La Flexico's"],
    ["6", "Jha Jupiter - Goodmorningg"],
    ["7", "Chxpo - Cookin Yams"],
    ["8", "SpaceGhostPurrp aka Purrple Haze - Geeked"],
    ["9", "Chxpo - Knock It Off"],
    ["10", "Slim Guerilla - Ice Cold Lady Pimp"],
    ["11", "SpaceGhostPurrp aka Purrple Haze - Zips"],
    ["12", "Taco El - Locc'd Out"],
    ["13", "Taco El - No Trust"],
    ["14", "Fr3ddy Thr3e - Bros on Go"],
    ["15", "Lil Rari - Dope Runna 2k16"],
    ["16", "TERRORT - Grew Up"],
    ["17", "SpaceGhostPurrp aka Purrple Haze - Get It"],
    ["18", "Taco El - Don't Fucc With Niggas"],
    ["19", "Chxpo - Blxxdy Freestyle"],
    ["20", "Fr3ddy Thr3e x Chxpo - Blxxdy Emoji's"],
    ["21", "LZA - Venemous"],
    ["22", "SCXNDORXMBO - Dafuq Is a Yatchi"],
    ["23", "Lil Rari - Slidin"],
    ["24", "MajinBlxxdy - I'm Blxxdy"],
    ["25", "SpaceGhostPurrp aka Purrple Haze - Life of a Scorpio Moon"],
  ];
  const cleanRowsFromTen = tracks.slice(9).map(([position, title]) => fakeRow([position, title]));
  const sequenceText = [
    "SpaceGhostPurrp aka Purrple Haze - King of Miami",
    "9:09",
    "2",
    "Chxpo x SpaceGhostPurrp aka Purrple Haze - Way Past Savage",
    "3:08",
    "3",
    "Chxpo x Black Kray - BMB2K16",
    "3:10",
    "4",
    "SpaceGhostPurrp aka Purrple Haze - Boss Mobb RBMG",
    "2:51",
    "5",
    "Chxpo x Black Kray - So Icey Goth La Flexico's",
    "4:57",
    "6",
    "Jha Jupiter - Goodmorningg",
    "3:35",
    "7",
    "Chxpo - Cookin Yams",
    "3:33",
    "8",
    "SpaceGhostPurrp aka Purrple Haze - Geeked",
    "2:17",
    "9",
    "Chxpo - Knock It Off",
    "4:21",
    "feat. Young Hoe",
    ...tracks.slice(9).flatMap(([position, title]) => [position, title, "2:50"]),
    "Saving...",
    "rymQ(function(){ track_ratings.init(); })",
    "track_ratings",
  ].join("\n");

  const document = fakeDocument({
    selectors: {
      "h1": ["BMB RVDIX by BMB Deathrow"],
      ".release_info tr": ["Released 2024"],
      ".tracklist": [fakeContainerWithText(cleanRowsFromTen, sequenceText)],
    },
  });

  const response = extractRymCurrentPage({
    document,
    location: { href: "https://rateyourmusic.com/release/mixtape/bmb-deathrow/bmb-rvdix/" },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.extract.tracks, tracks.map(([position, title]) => `${position} ${title}`));
  assert.equal(response.extract.tracks.length, 25);
  assert.equal(response.extract.tracks[0], "1 SpaceGhostPurrp aka Purrple Haze - King of Miami");
  assert.equal(response.extract.tracks[8], "9 Chxpo - Knock It Off");
  assert.equal(response.extract.tracks[9], "10 Slim Guerilla - Ice Cold Lady Pimp");
  assert.equal(response.extract.tracks[24], "25 SpaceGhostPurrp aka Purrple Haze - Life of a Scorpio Moon");
  assert.equal(response.extract.tracks.some((track) => /feat\.|Saving|rymQ\(|track_ratings/i.test(track)), false);
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
  assert.equal(response.page.reason, "not_rym_release_page");
});

test("rejects RYM artist and person pages as unsupported", () => {
  for (const href of [
    "https://rateyourmusic.com/artist/artist-name/",
    "https://rateyourmusic.com/person/person-name/",
    "https://rateyourmusic.com/release/live/artist-name/test-live/",
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

test("rejects supported RYM release URLs when DOM is not a release page", () => {
  const response = extractRymCurrentPage({
    document: fakeDocument({
      selectors: {
        "h1": ["BMB Deathrow"],
        ".release_info tr": ["RYM Rating 3.80 Ranked #12"],
      },
    }),
    location: { href: "https://rateyourmusic.com/release/mixtape/bmb-deathrow/bmb-rvdix/" },
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "unsupported_dom");
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

function fakeContainer(rows) {
  return {
    textContent: rows.map((row) => row.textContent).join("\n"),
    querySelectorAll(selector) {
      return selector === "tr, li, .track" ? rows : [];
    },
  };
}

function fakeContainerWithText(rows, textContent) {
  return {
    textContent,
    querySelectorAll(selector) {
      return selector === "tr, li, .track" ? rows : [];
    },
  };
}
