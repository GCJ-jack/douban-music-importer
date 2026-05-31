import assert from "node:assert/strict";
import test from "node:test";

import { buildAotyManualPasteImport } from "../src/core/aoty/aoty-manual-paste-import.js";
import { parseAotyManualPaste } from "../src/core/aoty/aoty-manual-paste-parser.js";
import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import { normalizeAotyAlbumPaste } from "../src/core/normalizers/aoty-album-normalizer.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  markDraftFieldConfirmed,
} from "../src/core/review/draft-review-state.js";
import { validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../src/core/validation/schema-validation.js";

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

test("parses sparse noisy AOTY album paste without generating track safe-fill", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/1792171-vince-staples-cry-baby.php";
  const extract = parseAotyManualPaste({
    sourceUrl,
    text: `
      Highly Anticipated
      Cry Baby
      by
      Vince Staples
      Release Date
      Jun 5, 2026
      Genre
      -
      Format
      LP
      Label
      Loma Vista
      Critic Score
      NR
      User Score
      NR
      Comments
      user123 this album will be great
      Amazon
      Apple Music
      Bandcamp
      Vinyl
      Purchasing Cry Baby...
      More Albums
      Full Discography
      Contributions By
      Submit Correction
      Add Critic Rating
    `,
  });

  assert.equal(extract.provider, "aoty");
  assert.equal(extract.sourceType, "album");
  assert.equal(extract.sourceId, "1792171");
  assert.equal(extract.sourceUrl, sourceUrl);
  assert.equal(extract.title, "Cry Baby");
  assert.equal(extract.artist, "Vince Staples");
  assert.equal(extract.releaseDate, "2026-06-05");
  assert.deepEqual(extract.tracks, []);
  assert.deepEqual(extract.genres, []);
  assert.deepEqual(extract.formats, ["LP"]);
  assert.deepEqual(extract.labels, ["Loma Vista"]);
  assert.ok(extract.warnings.some((warning) => warning.field === "release.tracklist"));

  const { metadata, draft, fillPayload } = pipeline(extract, sourceUrl);
  assertMetadataAndDraftValid(metadata, draft);
  assert.equal(metadata.source.provider, "aoty");
  assert.equal(metadata.source.sourceType, "album");
  assert.equal(metadata.source.id, "1792171");
  assert.equal(draft.fields.title.value, "Cry Baby");
  assert.equal(draft.fields.artists.value, "Vince Staples");
  assert.equal(draft.fields.releaseDate.value, "2026-06-05");
  assert.equal(draft.fields.publisher.value, "Loma Vista");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.match(draft.fields.externalLinks.value, /albumoftheyear\.org\/album\/1792171/);
  assert.equal(draft.fields.tracks, undefined);
  assert.equal(draft.fields.genre, undefined);
  assert.equal(draft.fields.media, undefined);
  assert.equal(draft.fields.coverImageUrl, undefined);
  assert.equal(draft.fields.barcode, undefined);
  assert.equal(draft.fields.catalogNumber, undefined);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "externalLinks"]);
  assertUnmappedIncludes(draft, "release.reviewOnly.formats");
});

test("parses AOTY plain text album paste with clean tracklist safe-fill", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/1998-kanye-west-my-beautiful-dark-twisted-fantasy.php";
  const extract = parseAotyManualPaste({
    sourceUrl,
    text: `
      Overview
      My Beautiful Dark Twisted Fantasy
      by
      Kanye West
      Release Date
      Nov 22, 2010
      Genre
      Pop Rap, Hip Hop
      Secondary Genres
      Art Pop, Experimental Hip Hop
      Tags
      maximalist, boastful, hedonistic, concept album, epic
      Label
      Def Jam, Roc-A-Fella
      Format
      LP
      Track List
      1 Dark Fantasy
      4:40
      94
      2 Gorgeous
      feat. Kid Cudi & Raekwon
      5:57
      91
      3 POWER
      4 All of the Lights
      Interlude
      5 All of the Lights
      6 Monster
      7 So Appalled
      8 Devil in a New Dress
      9 Runaway
      10 Hell of a Life
      11 Blame Game
      12 Lost in the World
      13 Who Will Survive in America
      Total Length
      Producer
      Kanye West, No ID, MIKE DEAN, The RZA, S1
      Writer
      K. West, M. Dean
      User Reviews
      Comments
      Lists
      Discography
    `,
  });

  assert.equal(extract.sourceId, "1998");
  assert.equal(extract.title, "My Beautiful Dark Twisted Fantasy");
  assert.equal(extract.artist, "Kanye West");
  assert.equal(extract.releaseDate, "2010-11-22");
  assert.deepEqual(extract.tracks, KANYE_TRACKS);
  assert.deepEqual(extract.labels, ["Def Jam", "Roc-A-Fella"]);
  assert.deepEqual(extract.formats, ["LP"]);
  assert.ok(extract.genres.includes("Pop Rap"));
  assert.ok(extract.genres.includes("Experimental Hip Hop"));

  const { metadata, draft, fillPayload } = pipeline(extract, sourceUrl);
  assertMetadataAndDraftValid(metadata, draft);
  assert.equal(draft.fields.title.value, "My Beautiful Dark Twisted Fantasy");
  assert.equal(draft.fields.artists.value, "Kanye West");
  assert.equal(draft.fields.releaseDate.value, "2010-11-22");
  assert.equal(draft.fields.publisher.value, "Def Jam; Roc-A-Fella");
  assert.equal(draft.fields.publisher.needsReview, true);
  assert.equal(draft.fields.tracks.value, KANYE_TRACKS.join("\n"));
  assertNoiseAbsent(draft.fields.tracks.value);
  assert.equal(draft.fields.genre, undefined);
  assert.equal(draft.fields.media, undefined);
  assert.equal(draft.fields.coverImageUrl, undefined);
  assert.equal(draft.fields.barcode, undefined);
  assert.equal(draft.fields.catalogNumber, undefined);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "tracks", "externalLinks"]);
});

test("prefers AOTY pasted HTML JSON-LD and track table without network or DOM access", () => {
  const sourceUrl = "https://www.albumoftheyear.org/album/1998-kanye-west-my-beautiful-dark-twisted-fantasy.php";
  const extract = parseAotyManualPaste({
    sourceUrl,
    text: `
      <html>
        <head>
          <link rel="canonical" href="${sourceUrl}">
          <meta property="og:title" content="Wrong fallback title">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "MusicAlbum",
              "@id": "${sourceUrl}",
              "url": "${sourceUrl}",
              "name": "My Beautiful Dark Twisted Fantasy",
              "byArtist": { "@type": "MusicGroup", "name": "Kanye West" },
              "datePublished": "2010-11-22",
              "genre": ["Pop Rap", "Hip Hop"],
              "aggregateRating": { "ratingValue": "94" }
            }
          </script>
          <script>window.cloudflare = true; analytics.track("album");</script>
        </head>
        <body>
          <div class="albumHeadline">
            <div class="artist">Kanye West</div>
            <h1 class="albumTitle">My Beautiful Dark Twisted Fantasy</h1>
          </div>
          <section class="details">
            <div>Format</div><div>LP</div>
            <div>Label</div><div>Def Jam, Roc-A-Fella</div>
            <div>Secondary Genres</div><div>Art Pop, Experimental Hip Hop</div>
          </section>
          <div id="tracklist">
            <table class="trackListTable">
              ${KANYE_TRACKS.map((track) => {
                const [position, ...titleParts] = track.split(" ");
                const title = titleParts.join(" ");
                return `<tr>
                  <td class="trackNumber">${position}</td>
                  <td class="trackTitle"><a href="/song">${title}</a></td>
                  <td class="featuredArtists">feat. Example</td>
                  <td class="length">4:40</td>
                  <td class="trackNotes">Producer Kanye West</td>
                  <td class="trackRating">94</td>
                </tr>`;
              }).join("")}
            </table>
          </div>
          <div class="albumReviewRow">Critic review text</div>
          <section>Popular User Reviews Recent User Reviews comments Year End Lists User Lists</section>
          <section>More Albums You May Also Like Amazon Apple Music Spotify SoundCloud Vinyl Contributions By</section>
          <img src="https://cdn.example.test/cover.jpg">
        </body>
      </html>
    `,
  });

  assert.equal(extract.sourceUrl, sourceUrl);
  assert.equal(extract.sourceId, "1998");
  assert.equal(extract.title, "My Beautiful Dark Twisted Fantasy");
  assert.equal(extract.artist, "Kanye West");
  assert.equal(extract.releaseDate, "2010-11-22");
  assert.deepEqual(extract.tracks, KANYE_TRACKS);
  assert.deepEqual(extract.genres, ["Pop Rap", "Hip Hop", "Art Pop", "Experimental Hip Hop"]);
  assert.deepEqual(extract.labels, ["Def Jam", "Roc-A-Fella"]);
  assert.deepEqual(extract.formats, ["LP"]);

  const { draft, fillPayload } = pipeline(extract, sourceUrl);
  assert.equal(draft.fields.tracks.value, KANYE_TRACKS.join("\n"));
  assert.equal(draft.fields.publisher.value, "Def Jam; Roc-A-Fella");
  assert.equal(draft.fields.publisher.needsReview, true);
  assertNoiseAbsent(draft.fields.tracks.value);
  assert.equal(draft.fields.genre, undefined);
  assert.equal(draft.fields.media, undefined);
  assert.equal(draft.fields.coverImageUrl, undefined);
  assert.deepEqual(Object.keys(fillPayload), ["title", "artists", "releaseDate", "publisher", "tracks", "externalLinks"]);
});

test("builds AOTY manual paste review state summary for background flow", () => {
  const result = buildAotyManualPasteImport({
    sourceUrl: "https://www.albumoftheyear.org/album/1998-kanye-west-my-beautiful-dark-twisted-fantasy.php",
    text: `
      My Beautiful Dark Twisted Fantasy
      by
      Kanye West
      Release Date
      Nov 22, 2010
      Track List
      1 Dark Fantasy
      2 Gorgeous
    `,
    fetchedAt: "2026-05-30T00:00:00.000Z",
    now: "2026-05-30T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.metadataSummary.provider, "aoty");
  assert.equal(result.metadataSummary.sourceType, "album");
  assert.equal(result.metadataSummary.title, "My Beautiful Dark Twisted Fantasy");
  assert.equal(result.metadataSummary.artist, "Kanye West");
  assert.equal(result.metadataSummary.normalizedValid, true);
  assert.equal(result.metadataSummary.draftValid, true);
  assert.ok(result.reviewState);
  assert.equal(result.reviewState.sourceSummary.provider, "aoty");
  assert.equal(result.reviewState.draft.fields.title.value, "My Beautiful Dark Twisted Fantasy");
  assert.equal(result.reviewState.draft.fields.tracks.value, "1 Dark Fantasy\n2 Gorgeous");
});

test("rejects missing AOTY manual paste URL", () => {
  const result = buildAotyManualPasteImport({
    sourceUrl: "",
    text: "My Beautiful Dark Twisted Fantasy",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_aoty_input");
  assert.equal(result.error.message, "请填写 AOTY album URL。");
});

test("rejects missing AOTY manual paste text", () => {
  const result = buildAotyManualPasteImport({
    sourceUrl: "https://www.albumoftheyear.org/album/1998-kanye-west-my-beautiful-dark-twisted-fantasy.php",
    text: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_aoty_input");
  assert.equal(result.error.message, "请粘贴 AOTY 页面可见文本或 HTML。");
});

function pipeline(extract, sourceUrl) {
  const metadata = normalizeAotyAlbumPaste({
    provider: "aoty",
    sourceType: "album",
    pageUrl: sourceUrl,
    fetchedAt: "2026-05-30T00:00:00.000Z",
    extractorVersion: "0.1.0-prototype",
    warnings: extract.warnings,
    raw: extract,
  });
  const draft = mapReleaseToDoubanDraft(metadata);
  let reviewState = createDraftReviewState({
    draft,
    sourceSummary: { provider: "aoty", sourceType: "album" },
    warnings: metadata.warnings,
    validation: {},
    now: "2026-05-30T00:00:00.000Z",
  });

  for (const fieldName of Object.keys(draft.fields)) {
    reviewState = markDraftFieldConfirmed(reviewState, fieldName, {
      now: "2026-05-30T00:00:00.000Z",
    });
  }

  return {
    metadata,
    draft,
    fillPayload: getFillableDraftFields(reviewState),
  };
}

function assertMetadataAndDraftValid(metadata, draft) {
  assert.deepEqual(validateAlbumReleaseMetadata(metadata), { ok: true, errors: [] });
  assert.deepEqual(validateDoubanMusicDraft(draft), { ok: true, errors: [] });
}

function assertUnmappedIncludes(draft, sourceField) {
  assert.ok(draft.unmapped.some((field) => field.sourceField === sourceField), `Expected ${sourceField} to be unmapped`);
}

function assertNoiseAbsent(value) {
  assert.equal(/feat\.|4:40|5:57|\b94\b|\b91\b|Interlude|Total Length|Producer|Writer|User Reviews|Comments/i.test(value), false);
}
