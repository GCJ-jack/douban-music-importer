# RYM Research for #12

Date: 2026-05-17

Scope: RYM 优先研究；不实现 importer，不绕过登录、验证码、访问限制或反爬，不批量抓取。

## Summary

RYM 对 album-level metadata 很有价值，尤其适合新发行或 Discogs release 尚不完整的场景。公开页面或公开索引文本通常能看到标题、艺人、发行日期、类型、流派、descriptors、语言、曲目和部分 credits。

但 RYM 当前不适合作为自动网络导入源。公开访问研究显示，RYM / Sonemic 对自动访问、抓取和爬取有明确限制，页面也存在 Cloudflare challenge 和访问稳定性风险。v0.2 不建议实现 RYM 页面自动请求、自动抓取或网络 importer。

建议进入 v0.2 prototype，优先探索 current-page extractor：用户自己打开 RYM album 页面并点击插件后，扩展只读取当前页面 DOM / 可见文本，在本地解析为 `DoubanMusicDraft`，再进入现有 review UI。manual paste / local parsing 只作为 current-page DOM 不稳定、字段不足或页面暂不支持时的 fallback。

## Field Availability Matrix

| Field | Public RYM album pages | Reliability | Notes |
|---|---:|---:|---|
| Title | yes | high | Album/release title visible. |
| Artist | yes | high | Main artist visible. |
| Release date | yes | medium-high | Often full date; sometimes only year or lower precision. |
| Type | yes | high | Album / EP / Single etc. |
| Genres | yes | high | Useful for review-only metadata; must not auto-fill custom selects. |
| Descriptors | yes | high | RYM-specific; useful for review context only. |
| Language | yes | medium | Visible on many pages, but not mapped in v0.1. |
| Tracklist | yes | medium-high | Track titles and durations are often visible. |
| Credits | partial | medium | Often broad/noisy; should remain review context unless explicitly mapped later. |
| Label/publisher | sometimes | low-medium | Appears in issue/version rows for some pages, absent or `n/a` on others. |
| Format/media | sometimes | low-medium | Issue rows may show CD / Digital / Vinyl, but RYM is not release-version-first. |
| Country | sometimes | low | Some issue rows show country; inconsistent. |
| Catalog number | rarely/not reliable | low | Not consistently visible in public indexed text. |
| Barcode | no reliable evidence | low | Should not be mapped from RYM. |
| Cover image URL | visible art presence only | low | Direct image URL not safely established; no auto cover handling. |
| External/source URL | yes | high | RYM page URL can be used as source attribution. |
| Ratings/rankings/reviews | yes | high | Do not import into Douban draft; community/user content is not needed for submission. |

## Sample Pages Observed

| Page | Shape | Useful fields | Weak/missing fields |
|---|---|---|---|
| `rateyourmusic.com/release/album/taylor-swift/the-life-of-a-showgirl/` | Album-centric with issue/version rows | title, artist, date, type, genres, descriptors, language, tracklist, credits; some issue labels/formats | barcode/catalog unreliable; cover URL not exposed safely |
| `rateyourmusic.com/release/album/wifiskeleton/suburban-daredevil/` | Album-centric, small issue list | title, artist, date, genres, descriptors, tracklist, total length | labels mostly absent or `n/a`; no barcode/catalog |
| `rateyourmusic.com/release/album/deftones/white-pony/` | Album-centric combined release view | title, artist, date, genres, descriptors, tracklist, credits | release-version metadata not stable enough |
| `rateyourmusic.com/release/album/drake/take-care/` | Album-centric with issue variants | title, artist, date, genres, descriptors, tracklist, credits | version-specific fields incomplete from public text |

## Access / Legal / Stability Risks

RYM should be treated as high risk for automated access.

Findings:

- RYM robots.txt and public policy summaries indicate automated access such as crawling, scraping, or spidering is not allowed without permission.
- Generic crawler access is disallowed.
- Direct automated requests may encounter Cloudflare challenge or HTTP 403 behavior.
- No stable public RYM / Sonemic API path suitable for importer integration was confirmed.
- RYM page HTML and product surfaces are actively changing, so DOM parsing would be brittle even aside from policy issues.

Sources reviewed:

- Sonemic project/API status: `https://sonemic.com/`
- RYM robots.txt: `https://rateyourmusic.com/robots.txt`
- RYM ToS URL referenced by robots.txt: `https://rateyourmusic.com/tos`
- ToS;DR RYM summary: `https://tosdr.org/en/service/1806`
- Public indexed RYM release pages under `rateyourmusic.com/release/...`

## Architecture Fit

Current v0.1 downstream pipeline can be reused if RYM eventually produces normalized metadata:

`RYM source -> AlbumReleaseMetadata -> DoubanMusicDraft -> review state -> fill payload -> Douban safe fill`

Reusable pieces:

- Douban draft mapper, if RYM emits the existing normalized shape.
- Review/edit/confirm/remove/readiness logic.
- Draft storage and Douban safe fill.
- v0.1 regression fixture pattern.

Needed before any RYM implementation:

- Make source metadata provider-aware:
  - `provider: "discogs" | "rym"`
  - `sourceType: "release" | "album"`
  - optional/no `apiUrl` for non-API/manual sources
  - `externalUrls.provider: "rym"`
  - provider-specific attribution text
- Treat RYM as album-centric, not release-version-centric.
- Do not infer publisher/media/barcode/catalog/country from weak issue rows unless future research proves reliable and allowed.
- Do not import ratings, rankings, reviews, charts, lists, or user-specific data.

## Recommended v0.2 Prototype

Proceed with a narrow v0.2 prototype only if it is user-initiated, current-page-only, and local:

- User manually opens an RYM album page.
- User clicks the extension.
- The extension reads only the current page DOM / visible text after that user action.
- Parsing happens locally from content already visible in the current tab.
- Output is a `DoubanMusicDraft`.
- Draft enters the existing review UI.
- Existing no-submit, no-overwrite, no-login, no-cookie and safe-fill boundaries remain unchanged.
- No RYM host permission is added.
- A future implementation may add the minimal `scripting` permission to support one-shot injection under `activeTab`.
- Manual paste remains as fallback when the current-page extractor cannot confidently read the page.

Out of scope:

- Automated requests to `rateyourmusic.com`.
- RYM network importer or background fetch of RYM URLs.
- Scraping release, chart, list, collection, search, or export pages beyond the current user-opened album page.
- Login/session/cookie reuse.
- CAPTCHA, Cloudflare, IP block, VPN, or rate-limit handling.
- Background jobs, retries, pagination, or bulk import.
- Cover download/upload automation.
- Broad permissions such as `<all_urls>`, `cookies`, `webRequest`, or unnecessary `tabs`.

## Suggested #12 Update

#12 should remain open as roadmap/research.

Recommended conclusion:

RYM research completed for the first pass. RYM is useful for album-level fields such as title, artist, release date, genres/descriptors, language, tracklist, credits, and source attribution, especially for new albums that may not yet have complete Discogs releases. However, RYM is not currently suitable for automated network import because public policy signals prohibit automated access without permission, generic crawling is disallowed, Cloudflare/challenge behavior is likely, and no stable public API path was confirmed.

Recommendation: do not implement RYM scraping/importing in v0.2. If we prototype anything, prefer a user-initiated current-page extractor that reads only DOM / visible text from the RYM album page the user already opened, then feeds the existing review draft pipeline. Keep manual paste as a fallback for DOM drift or unsupported pages. Keep #12 open as the roadmap/research issue and track implementation in a separate v0.2 prototype issue.
