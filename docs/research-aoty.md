# AOTY Research for #14

Date: 2026-05-28

Scope: AOTY first-pass research; no importer implementation, no automated requests, no crawling, no login/cookie access, no CAPTCHA or access-limit handling.

## Summary

AOTY appears useful as an album-level metadata reference. Public album pages and indexed snippets commonly expose title, artist, release date, format, label, genre, source URL, and sometimes tracklist or credits context.

However, AOTY is not suitable for a network importer. The public Terms of Use prohibit bots, scrapers, or automated tools without written permission, and no official API or dataset suitable for importer integration was confirmed. Public access can also show Cloudflare or HTTP 403 style access friction.

Recommended first pass: manual paste / local parsing only. The user may copy visible AOTY album metadata into a local parser or manual input surface, then review and edit the resulting Douban draft before any safe-fill handoff. Do not implement an AOTY current-page DOM extractor until the policy and access-risk questions are explicitly accepted.

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

Current downstream pipeline can be reused only if AOTY produces normalized metadata through a local/manual source:

`AOTY manual input -> AlbumReleaseMetadata -> DoubanMusicDraft -> review state -> fill payload -> Douban safe fill`

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

Proceed only with manual paste / local parsing for the first pass:

- User manually opens an AOTY album page.
- User copies visible album metadata into a local paste/import surface.
- Parsing happens locally from user-provided text.
- Output is a reviewable `DoubanMusicDraft`.
- Safe-fill remains limited to existing safe text fields: title, artists, release date, tracklist, and source/reference links.
- Genres/tags, format/media, label/publisher, and cover visibility remain review-only or unmapped.
- Existing no-submit, no-overwrite, no-login, no-cookie, and safe-fill boundaries remain unchanged.
- No AOTY host permission is added.

Out of scope:

- AOTY network importer.
- AOTY current-page DOM extractor until policy risk is explicitly accepted.
- Automated requests to `albumoftheyear.org`.
- Scraping album, chart, list, search, user, review, comment, or pagination pages.
- Login/session/cookie reuse.
- CAPTCHA, Cloudflare, IP block, VPN, or rate-limit handling.
- Background jobs, retries, pagination, or bulk import.
- Cover or audio download/upload/reuse automation.
- Ratings, critic scores, user scores, reviews, rankings, charts, lists, comments, or user-specific data.

## Suggested #14 Update

#14 should remain open until this research is reviewed and a follow-up implementation issue is created or explicitly deferred.

Recommended conclusion:

AOTY has useful album-level metadata for draft preparation, but it should not become a network importer. Because AOTY's public terms prohibit automated tools without permission and no official API path was confirmed, the recommended first pass is manual paste / local parsing only. Keep AOTY fields conservative: title, artists, release date, tracklist, and source URL can become draft candidates after review; genres/tags, label, format, and cover visibility stay review-only or unmapped; ratings, reviews, rankings, comments, charts, barcode, catalog number, country, version metadata, and cover image URLs stay out of scope.

Optional follow-up issue:

`Prototype: AOTY manual paste to Douban draft`
