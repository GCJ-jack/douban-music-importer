# AOTY Research for #14

Date: 2026-05-28

Scope: AOTY first-pass research and follow-up scope decision; no network importer, no automated requests, no crawling, no login/cookie access, no CAPTCHA or access-limit handling.

## Summary

AOTY appears useful as an album-level metadata reference. Public album pages and indexed snippets commonly expose title, artist, release date, format, label, genre, source URL, and sometimes tracklist or credits context.

However, AOTY is not suitable for a network importer. The public Terms of Use prohibit bots, scrapers, or automated tools without written permission, and no official API or dataset suitable for importer integration was confirmed. Public access can also show Cloudflare or HTTP 403 style access friction.

Updated scope decision: proceed with a user-initiated current-page DOM extractor as the primary path, with manual paste / local parsing retained as fallback. The user must manually open an AOTY album page and click the extension before any current-page extraction runs. The extension must read only the currently visible page DOM/text in that active tab, parse locally, and then require review/edit before any safe-fill handoff.

This decision accepts the additional current-page DOM-reading risk for a narrow, user-initiated prototype. It does not permit an AOTY network importer, fetching AOTY URLs, background fetching, scraping, crawling, pagination, bulk access, cookie/session reuse, login/CAPTCHA/Cloudflare bypass or handling, cover/audio download/upload/reuse, ratings/reviews/charts/comments/user-data import, or automatic Douban submission.

Important product boundary: AOTY should be treated as an album-level source, not a release/version source. It should not generate barcode, catalog number, country, pressing, cover image URL, ratings, reviews, rankings, charts, comments, or user-specific data.

## Field Availability Matrix

| Field | Public AOTY album pages | Reliability | Notes |
|---|---:|---:|---|
| Title | yes | high | Album title is visible. |
| Artist | yes | high | Main artist is visible. |
| Release date | yes | medium-high | Often visible in details; precision may vary. |
| Genres/tags | yes | medium-high | Useful as review-only context; must not auto-fill Douban custom selects. |
| Tracklist | sometimes | medium | Needs sample validation across page variants before any parser commitment. |
| Label/publisher | yes/sometimes | medium | AOTY label is album-level context; do not auto-fill Douban publisher initially. |
| Format/media | yes/sometimes | low-medium | AOTY format such as LP may be visible; keep review-only. |
| Source URL | yes | high | AOTY album URL can be used for attribution. |
| Cover visibility | yes | low | Do not map direct image URLs, fetch cover art, upload cover art, or reuse images. |
| Ratings/scores | yes | high | Do not import critic/user scores into Douban draft. |
| Reviews/comments/charts | yes | high | Do not import community/editorial content. |
| Barcode/catalog/country/version metadata | no reliable evidence | low | Out of scope for AOTY. |

## Access / Legal / Stability Risks

AOTY should be treated as high risk for automated access.

Findings:

- AOTY Terms of Use prohibit bots, scrapers, or automated tools without written permission.
- No official public AOTY API or dataset suitable for importer integration was confirmed.
- Third-party API wrappers appear to rely on web parsing, which is not an acceptable basis for this extension.
- Direct automated access may encounter Cloudflare or HTTP 403 behavior.
- AOTY pages contain ratings, reviews, comments, lists, and social features that are unnecessary for Douban submission and should not be copied.

Sources reviewed:

- AOTY Terms of Use: `https://www.albumoftheyear.org/terms-of-use/`
- Public indexed AOTY album pages under `albumoftheyear.org/album/...`
- AOTY account/features page: `https://www.albumoftheyear.org/account/`
- Third-party package notes for `album-of-the-year-api` indicating web parsing rather than official API support.

## Architecture Fit

Current downstream pipeline can be reused if AOTY produces normalized metadata through a local current-page or manual source:

`AOTY current page or manual input -> AlbumReleaseMetadata -> DoubanMusicDraft -> review state -> fill payload -> Douban safe fill`

Reusable pieces:

- Provider-aware normalized metadata shape.
- Douban draft mapper, if AOTY emits the existing album-level metadata fields.
- Review/edit/confirm/remove readiness logic.
- Draft storage and Douban safe fill.

Needed before any AOTY prototype:

- Add provider-specific attribution for AOTY source URLs.
- Treat AOTY as album-centric, not release-version-centric.
- Keep genres/tags, label, format, and cover visibility review-only or unmapped for the first pass.
- Do not infer publisher/media/barcode/catalog/country from AOTY.
- Do not import ratings, reviews, rankings, charts, comments, lists, or user-specific data.

## Recommended Prototype Path

Proceed with a narrow current-page extractor as the primary path:

- User manually opens an AOTY album page.
- User clicks the extension.
- The extension reads only the current active tab's visible DOM/text after that user action.
- Parsing happens locally from current-page content.
- Output is a reviewable `DoubanMusicDraft`.
- Safe-fill remains limited to existing safe text fields: title, artists, release date, tracklist, and source/reference links.
- Genres/tags, format/media, label/publisher, and cover visibility remain review-only or unmapped.
- Existing no-submit, no-overwrite, no-login, no-cookie, and safe-fill boundaries remain unchanged.
- No AOTY host permission is added; prefer the existing `activeTab` + `scripting` model.
- Manual paste / local parsing remains available as fallback when current-page extraction is unsupported, incomplete, or too noisy.

Out of scope:

- AOTY network importer.
- Fetching AOTY URLs or making automated requests to `albumoftheyear.org`.
- Scraping, crawling, chart/list/search/user/review/comment access, pagination, or bulk import.
- Login/session/cookie reuse.
- CAPTCHA, Cloudflare, IP block, VPN, login, payment, download, or rate-limit handling.
- Background jobs, retries, pagination, or bulk import.
- Cover or audio download/upload/reuse automation.
- Ratings, critic scores, user scores, reviews, rankings, charts, lists, comments, or user-specific data.

## Suggested #14 Update

#14 is closed. #16 now carries the follow-up prototype scope.

Recommended conclusion:

AOTY has useful album-level metadata for draft preparation, but it should not become a network importer. Because AOTY's public terms prohibit bots/scrapers/automated tools without permission and no official API path was confirmed, the accepted prototype path is user-initiated current-page DOM extraction only, with manual paste / local parsing as fallback. Keep AOTY fields conservative: title, artists, release date, tracklist, and source URL can become draft candidates after review; genres/tags, label, format, and cover visibility stay review-only or unmapped; ratings, reviews, rankings, comments, charts, barcode, catalog number, country, version metadata, and cover image URLs stay out of scope.

Follow-up issue:

`Prototype: AOTY current-page extractor to Douban draft`
