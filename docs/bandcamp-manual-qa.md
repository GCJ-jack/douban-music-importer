# Bandcamp Current-Page Manual QA for #17

This document records the Chrome manual QA pass for GitHub issue #17:
`Bandcamp current-page album extractor to Douban draft`.

## QA Goal

Validate that the user-initiated Bandcamp current-page workflow reads only the
active album page, creates a reviewable Douban draft, and preserves the
existing safe-fill and no-overwrite boundaries.

## Required Sample

- URL: `https://xumstudios.bandcamp.com/album/dark-angels`
- Expected title: `Dark Angels`
- Expected artist: `SpaceGhostPurrp`
- Expected release date: `2023-11-20`
- Expected track count: `14`
- Hosting account `XUM` must not become the artist or Douban publisher.

## Expected Workflow

1. User manually opens the Bandcamp album page.
2. Popup shows one primary action: `读取当前 Bandcamp 页面`.
3. Nothing is extracted until the user clicks the action.
4. The action reads only the current active tab DOM / JSON-LD.
5. Review source displays `Bandcamp current page`.
6. Safe-fill is limited to `title`, `artists`, `releaseDate`, `tracks`, and
   `externalLinks`.
7. Existing Douban values are not overwritten and the form is not submitted.

## Safety Checks

- No Bandcamp fetch, network importer, host permission, cookie access, storage
  access, crawling, pagination, or background extraction.
- No price, offers, commerce, merch, audio, stream, download, cover/image URL,
  comment, sponsor, supporter, recommendation, fan, user, or account data in
  raw source metadata, review state, or safe-fill.
- Tags/genres, hosting publisher/label, format/media, and cover visibility stay
  review-only / unmapped.

## QA Record

| Case | Observed result | Accept? | Notes |
|---|---|---|---|
| Dark Angels popup detection and click-to-read | Pass | Yes | On the real album page, the popup identified `Bandcamp` / `Album` / `可读取当前页` and showed only `读取当前 Bandcamp 页面`. No draft appeared before the click. |
| Extracted metadata and Review UI | Pass | Yes | After the click, the review UI showed `Dark Angels`, `SpaceGhostPurrp`, release year `2023`, all 14 tracks, the album URL, and `Bandcamp current page`. `XUM` was not mapped as artist or publisher. |
| Douban safe-fill and no-overwrite | Pass | Yes | Chrome QA confirmed the result stayed in review UI and did not automatically hand off, fill, or submit a Douban form. Automated form tests confirm safe-field filtering, no-overwrite, and no-submit behavior. |

Chrome manual QA completed on June 10, 2026.

## Automated Evidence

- Core extractor tests cover matching current-page JSON-LD, restricted DOM
  fallback, recommendation filtering, malformed JSON-LD, duplicate legal
  titles, unsupported pages, review-only mapping, and safe-fill fields.
- Workflow tests cover popup URL detection, background workflow output, review
  source summary, user-initiated wiring, and current-page permission boundary.
- Existing Douban form tests cover safe fields, no-overwrite, unsupported
  fields, hidden/system fields, lookup-page rejection, and no submission.
