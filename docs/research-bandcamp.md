# Bandcamp Research for #15

Date: 2026-05-28

Scope: Bandcamp first-pass research; no importer implementation, no network importer, no crawling, no bulk access, no login/cookie access, no payment/download handling, and no cover/audio reuse.

Implementation follow-up: GitHub issue #17 implements the recommended
user-initiated current-page-only prototype. See
[`bandcamp-manual-qa.md`](bandcamp-manual-qa.md) for closing evidence.

## Summary

Bandcamp has useful album-level and artist-or-label-hosted metadata for future Douban draft preparation. Public album pages commonly expose album title, artist, release date, tracklist, tags, source URL, visible cover art, and purchase or media-format context.

Recommended first pass: user-initiated current-page-only extractor. The user manually opens a Bandcamp album page and clicks the extension. The extension should read only the current page's visible DOM/text and parse locally into reviewable draft metadata. Manual paste / local parsing should remain the fallback for unsupported DOM variants, ambiguous artist/label-host pages, or insufficient confidence.

Bandcamp should not become a network importer. Do not request Bandcamp pages from the extension, crawl, paginate, bulk fetch, read cookies, handle login/CAPTCHA/Cloudflare/paywall/payment/download flows, or download, upload, map, or reuse cover/audio resources.

Important product boundary: Bandcamp should be treated as an album-level source with possible artist/label-host ambiguity, not as a Discogs-style release/version source. The first pass should use Bandcamp only for title, artists, release date, tracklist, and source/reference attribution. Tags/genres, label/publisher, format/media, cover visibility, description, and credits should remain review-only or unmapped.

## Field Availability Matrix

| Field | Public Bandcamp album pages | Reliability | Notes |
|---|---:|---:|---|
| Title | yes | high | Album title is visible on album pages. |
| Artist | yes | high | Artist is visible, but label-hosted pages may need careful attribution. |
| Release date | yes/sometimes | medium-high | Often visible as a released date; some pages may omit or vary wording. |
| Tracklist | yes | high | Track titles and durations are commonly visible. |
| Tags/genres | yes/sometimes | medium | Useful as review-only context; must not auto-fill Douban custom selects. |
| Label/publisher | sometimes | medium-low | Artist, label, and hosting account can be ambiguous; do not auto-fill publisher initially. |
| Format/media | yes/sometimes | medium | Digital Album, CD, vinyl, cassette, and merch formats may be visible; keep review-only. |
| Source URL | yes | high | Bandcamp album URL can be used for source/reference attribution. |
| Cover visibility | yes | low | Cover art may be visible, but do not map direct image URLs or reuse images. |
| Price/purchase/download/streaming/audio | yes | high | Commerce and media-access data are out of scope. Do not import prices, purchase state, download links, streaming state, previews, or audio URLs. |

## Access / Legal / Stability Risks

Bandcamp should be treated as moderate-to-high risk for automated access and resource reuse.

Findings:

- Bandcamp has an official API, but the documented API is account / label / sales / merch oriented and requires access credentials. It is not a public metadata importer path for arbitrary album pages.
- Public album pages mix metadata with commerce, streaming, downloads, merch, fan/supporter content, comments, and social proof. The extension must avoid importing commerce, audio, cover-resource, and user/social data.
- Bandcamp pages may vary significantly across artist pages, label-hosted releases, digital-only releases, physical merch bundles, preorders, sold-out products, and subscription or private-library states.
- Current-page extraction should only read the user-opened page after user action. It should not fetch additional Bandcamp URLs, follow pagination, enumerate discographies, or traverse artist/label pages.
- Do not read cookies or depend on login, purchase state, fan collection, private library, paywall, download links, or payment flows.
- Do not handle CAPTCHA, Cloudflare, IP blocks, VPNs, rate limits, or other access-limit behavior.
- Do not download, upload, map, reuse, or persist cover images, audio previews, audio files, or paid/private resources.

Sources reviewed:

- Bandcamp API documentation: `https://bandcamp.com/developer`
- Bandcamp Terms of Use: `https://bandcamp.com/terms_of_use`
- Bandcamp Help Center metadata article: `https://get.bandcamp.help/hc/en-us/articles/38588625092503-Music-Metadata-on-Bandcamp`
- Public indexed Bandcamp album pages under `*.bandcamp.com/album/...`

## Architecture Fit

Current downstream pipeline can be reused if Bandcamp produces normalized metadata from the current page:

`Bandcamp current page -> AlbumReleaseMetadata -> DoubanMusicDraft -> review state -> fill payload -> Douban safe fill`

Reusable pieces:

- Provider-aware normalized metadata shape.
- Douban draft mapper, if Bandcamp emits the existing album-level metadata fields.
- Review/edit/confirm/remove readiness logic.
- Draft storage and Douban safe fill.
- Regression fixture pattern from Discogs, RYM, and AOTY work.

Needed before any Bandcamp prototype:

- Add provider-specific attribution for Bandcamp source URLs.
- Treat Bandcamp as album-level metadata, not release/version metadata.
- Explicitly model artist/label-host ambiguity. A release hosted on a label page may not mean the label should become Douban publisher.
- Keep tags/genres, label/publisher, format/media, cover visibility, description, and credits review-only or unmapped for the first pass.
- Do not infer barcode, catalog number, country, pressing/version metadata, publisher, or media from Bandcamp commerce widgets.
- Safe-fill should remain limited to existing safe text fields: title, artists, release date, tracklist, and source/reference links.

## Recommended Prototype Path

Proceed with a narrow current-page-only prototype:

- User manually opens a Bandcamp album page.
- User clicks the extension.
- The extension reads only the current page DOM / visible text after that user action.
- Parsing happens locally from content already visible in the current tab.
- Output is a reviewable `DoubanMusicDraft`.
- Safe-fill remains limited to title, artists, release date, tracks, and source/reference links.
- Tags/genres, label/publisher, format/media, cover visibility, description, and credits remain review-only or unmapped.
- Existing no-submit, no-overwrite, no-login, no-cookie, no-bulk-fetch, and safe-fill boundaries remain unchanged.
- Manual paste / local parsing remains the fallback when current-page extraction cannot confidently identify the page or fields.
- Do not add Bandcamp host permission unless a future issue explicitly reviews why `activeTab` plus user action is insufficient.

Out of scope:

- Bandcamp network importer.
- Automated requests to Bandcamp pages.
- Crawling artist pages, label pages, discographies, track pages, tag pages, search pages, fan pages, comments, collections, or pagination.
- Login/session/cookie reuse.
- CAPTCHA, Cloudflare, IP block, VPN, rate-limit, paywall, payment, or download handling.
- Background jobs, retries, pagination, or bulk import.
- Price, purchase, sale, discount, subscription, shipping, merch inventory, or availability data.
- Download links, streaming state, audio preview URLs, audio files, stems, bonus files, private library data, or paid resources.
- Cover image URL extraction, cover download/upload/reuse, or automatic cover mapping.
- Comments, fan/supporter data, sales/purchase info, collection data, followers, ratings, reviews, charts, or user-specific data.
- Barcode, catalog number, country, pressing/version metadata, or release-version selection.

## Suggested #15 Update

#15 research produced follow-up implementation issue #17.

Recommended conclusion:

Bandcamp research completed for the first pass. Bandcamp is useful as an album-level / artist-or-label-hosted metadata source, especially for independent releases and releases that may not have complete Discogs coverage. Unlike AOTY, Bandcamp appears suitable for a narrow user-initiated current-page extractor because the user is already viewing the public album page and the extension can parse only visible DOM/text locally after explicit user action. However, Bandcamp should not become a network importer, crawler, commerce parser, audio/cover resource tool, or user/social data importer.

Recommended follow-up issue:

`Prototype: Bandcamp current-page album extractor to Douban draft`
