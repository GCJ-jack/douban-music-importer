# RYM Current-Page Manual QA for #13

This document defines the manual QA pass for GitHub issue #13:
`v0.2: RYM current-page album extractor to Douban draft prototype`.

## QA Goal

Validate that the RYM current-page extractor works on real user-opened RYM
release pages before #13 is closed.

The QA pass should confirm that the extension can read the current tab,
extract album-level RYM metadata locally, create a reviewable Douban draft, and
preserve the existing safe-fill boundaries.

## Current Extractor Coverage

Supported RYM URL shapes:

- `/release/album/...`
- `/release/mixtape/...`
- `/release/ep/...`
- `/release/single/...`
- `/release/comp/...`

Supported extracted fields:

- `provider`: `rym`
- `sourceType`: `album`
- `sourceUrl`
- `releaseType`, kept as review-only / unmapped metadata
- `title`
- `artist`
- `releaseDate`, including year-only precision
- `genres`, review-only
- `descriptors`, review-only
- `tracks`

Expected page rejection behavior:

- Artist, person, chart, list, and other non-release pages should return
  unsupported.
- Supported release URLs with non-release DOM should return `unsupported_dom`.
- If required fields cannot be confidently extracted, the draft should include
  warnings instead of guessing.

## Safety Boundaries

The RYM prototype must not:

- Fetch RYM URLs or implement a network importer.
- Add RYM host permissions.
- Read cookies.
- Handle login, CAPTCHA, Cloudflare, access limits, or session state.
- Bulk scrape, crawl, paginate, retry, or run background jobs.
- Auto-submit anything to Douban.
- Auto-fill Douban custom selects.
- Auto-generate publisher, barcode, catalog number, media, country, or cover
  image fields from RYM.
- Fetch, upload, reuse, or map RYM cover image URLs.
- Import RYM rating, ranking, review, chart, list, or user-specific data.

## Suggested Manual QA Samples

Use real RYM pages that are already open in the browser. Do not fetch or crawl
RYM pages from code.

1. Standard album page
   - Typical title and artist DOM.
   - Released full date or year.
   - Numeric tracklist.
   - Confirms the happy path.

2. Album page with `Title by Artist` heading
   - Confirms `title` excludes `by Artist`.
   - Confirms `artist` is extracted separately.

3. Mixtape page with long or split tracklist
   - Prefer a page where the tracklist is split across DOM/text structures.
   - Confirms all tracks are present in order.
   - Confirms credits, ratings, and fallback fragments do not pollute tracks.

4. EP or single page
   - Short tracklist and possibly sparse metadata.
   - Confirms non-album release URL support and reasonable warnings.

5. Compilation page
   - Multi-artist or compilation-style tracks.
   - Confirms track titles such as `Artist - Title` are preserved.
   - Confirms release type remains review-only and does not map to safe fill.

## QA Record Template

```markdown
| Case | RYM URL | Release type | Page shape | Expected fields | Observed result | Warnings | Draft safe-fill payload | Accept? | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 |  | album | Standard album, numeric tracks | title, artist, releaseDate, genres/descriptors review-only, full tracklist, sourceUrl |  |  | title/artists/releaseDate/tracks/externalLinks only | Yes/No |  |
| 2 |  | album | Heading contains Title by Artist | title excludes `by Artist`; artist extracted correctly |  |  | No genre/releaseType safe fill | Yes/No |  |
| 3 |  | mixtape | Split/long tracklist | tracks complete and ordered 1..N; no duplicate fallback/noise |  |  | title/artists/releaseDate/tracks/externalLinks only | Yes/No |  |
| 4 |  | ep/single | Short release, sparse fields | supported page; year precision if only year; warnings for missing fields |  |  | no releaseType/media/publisher safe fill | Yes/No |  |
| 5 |  | comp | Compilation / multi-artist | title/artist acceptable; `Artist - Title` track titles preserved |  |  | no publisher/cover/media safe fill | Yes/No |  |
```

For each sample, record:

- Whether the popup recognizes the page as supported.
- Extracted `title`, `artist`, `releaseDate`, `releaseType`, `genres`,
  `descriptors`, `tracks`, and `sourceUrl`.
- Whether tracklist order and line boundaries are correct.
- Whether warnings are clear and expected.
- Whether review UI shows the RYM source clearly.
- Whether the final safe-fill payload excludes review-only and unsupported
  fields.

## Minimum Evidence Before Closing #13

Before closing #13, collect manual QA evidence for at least three real RYM pages:

- One standard album page.
- One mixtape or other long tracklist page with split or noisy DOM behavior.
- One non-album supported release type, such as EP, single, or compilation.

Each accepted sample should show:

- The page is detected only when both URL and DOM match a supported RYM release.
- `title` and `artist` are correct.
- `releaseDate` is correct, including year-only precision when applicable.
- `tracks` are complete, ordered, one track per line, and free of rating,
  credits, script, `Saving...`, `track_ratings`, and fallback duplicate noise.
- `genres`, `descriptors`, and `releaseType` stay review-only / unmapped.
- No publisher, barcode, catalog number, media, country, or cover image field is
  generated from RYM.
- Review UI shows the RYM source and any warnings clearly.
- Douban safe-fill payload only includes supported safe text fields.

If a real sample reveals a blocking DOM variant, fix or explicitly defer it
before closing #13. Non-blocking hardening work can be split into follow-up
issues.
