# Douban Music New Subject Form Research

This document records observations from an authenticated Chrome session. It is research input for the v0.1 Douban Form Assistant, not a final selector contract.

## Confirmed URLs

- `https://music.douban.com/new_subject`
- `https://music.douban.com/new_subject?cat=1003&search_text=<query>`

The new-subject flow is not a single form in the common case. It starts with a short lookup / duplicate-check step, then can proceed to a detailed metadata form.

## Step 1: Lookup / Duplicate Check

Observed heading:

- `添加新的唱片`

Observed visible fields:

- `唱片名`
- `条形码`

Observed actions:

- `下一步`
- `取消`
- `添加无条形码的唱片`

Product implication:

- Many real-world album additions may not have a barcode available.
- v0.1 should treat `添加无条形码的唱片` as a common path, not an exception.
- Barcode should be imported when Discogs provides it, but lack of barcode should not block the Douban-assisted flow.
- The assistant should not click `下一步` or `添加无条形码的唱片` automatically. It may explain which step the user is on and wait for user action.

## Step 2: Detailed Album Form

Observed heading from the detailed form:

- `添加Tony! Toni! Toné!`

Observed visible fields:

- `唱片名`
- `又名`
- `表演者`
- `流派`
- `专辑类型`
- `介质`
- `发行时间 (必填)`
- `出版者 (必填)`
- `碟片数`
- `ISRC`
- `曲目`
- `简介`
- `参考资料 (必填)`

Observed action:

- `下一步`
- `取消`

Field behavior seen from the page:

- `又名` supports adding multiple values with a `+` control.
- `表演者` supports multiple rows and a `+` control.
- `流派`, `专辑类型`, and `介质` are selection controls.
- `曲目` is a multiline textarea; one track title per line.
- `参考资料` is required and should be a good place for source links / attribution, subject to final selector confirmation.

## v0.1 Mapping Notes

Likely high-value draft mappings:

- Discogs release title -> `唱片名`
- Alternative / translated titles -> `又名`
- Main artists -> `表演者`
- Genres / styles -> `流派` with review required
- Formats -> `专辑类型` / `介质` with review required
- Release date -> `发行时间`
- Labels -> `出版者`
- Format quantity -> `碟片数`
- ISRC identifiers -> `ISRC`, if available
- Tracklist -> `曲目`
- Discogs release URL and attribution -> `参考资料`
- Notes -> `简介`, with review required

## Remaining Gaps

Still need exact DOM details before implementation:

- `name` / `id` / stable selectors for every supported field.
- Exact option values for `流派`, `专辑类型`, and `介质`.
- Whether the detailed form URL changes after choosing the no-barcode path.
- Validation behavior for required fields.
- Whether `参考资料` accepts plain source URLs cleanly.
- Whether barcode path and no-barcode path produce the same detailed form.

Until those are confirmed, the Douban Form Assistant should prefer label-based detection plus conservative fallback selectors, and it must keep the no-submit rule.
