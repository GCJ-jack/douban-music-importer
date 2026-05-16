# v0.1 Regression Fixtures

This document records the fixture coverage used to protect the v0.1 Discogs-to-Douban flow.

Automated fixture data lives in `tests/fixtures/discogs-release-fixtures.js`.

## Fixture Set

| Fixture | Reason | Expected coverage |
| --- | --- | --- |
| `standard-cd-release` | Standard western CD release with complete high-priority metadata. | Title, artist, full date, label, barcode presence, tracklist, source URL. |
| `no-barcode-release` | Release missing optional barcode should still produce a usable draft and fill payload. | Year precision fallback, missing barcode tolerance, no catalog number from `none`. |
| `multi-artist-multi-label-vinyl` | Lossy multi-value mappings should remain visible, reviewable, and fill only after confirmation. | Multiple artists, multiple labels, vinyl format descriptions, side positions. |
| `cjk-special-characters` | CJK, accents, punctuation, and special characters must survive the full import chain. | CJK title/artist/track text, accent preservation, month precision. |
| `multi-disc-nested-tracklist` | Nested or sectioned tracklists should flatten into a reviewable Douban track textarea value. | Multi-disc format quantity, nested sub-tracks, flattened track textarea output. |

## Regression Scenarios

The automated v0.1 regression tests cover:

- Discogs raw fixture -> normalized release metadata.
- Normalized release metadata -> Douban draft.
- Douban draft -> review state.
- Confirmed review state -> #7 fill payload.
- Fill payload -> Douban detailed form safe text input / textarea filling.
- No-overwrite behavior for existing Douban form values.
- Unsupported fields ignored: barcode, genre, media, cover image URL, catalog number, and unmapped data.
- Lookup / duplicate-check page detection without filling.
- Non-target page detection without filling.
- Hidden/system fields unchanged: `ck`, `cat`, `no_uid`, `search_text`, `m_48`, and custom select backing fields.
- Submit control untouched.

## Regression Policy

When a real parsing, mapping, review, or fill bug is found:

1. Add or update the smallest fixture that reproduces the bug.
2. Record the reason for the fixture and expected high-level fields.
3. Add a failing regression assertion before changing behavior.
4. Keep source data minimal and stable; do not include private user data.
5. Keep the v0.1 safety boundaries intact: no automatic submission, no login automation, no cookies, no CAPTCHA handling, no hidden/system field modification, and no broad permissions.
