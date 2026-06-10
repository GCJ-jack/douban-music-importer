# Changelog

## Unreleased

### Added

- Chrome Manifest V3 extension scaffold.
- Discogs release URL detection and `release_id` parsing.
- Single-release Discogs official API import.
- Raw source metadata local storage.
- Release metadata normalizer.
- Douban draft mapper.
- Review UI with edit, remove, confirm, warnings, confidence, and unmapped data.
- Session-first draft review storage.
- Douban new-subject lookup/detail page detection.
- Safe assisted filling for supported text input / textarea fields on the detailed form.
- User-initiated RYM, AOTY, and Bandcamp current-page album extractors using
  the existing review and safe-fill flow.
- AOTY manual paste fallback.
- v0.1 regression fixtures and tests.
- Privacy, permissions, contribution, security, roadmap, and release checklist documentation.

### Safety Boundaries

- No automatic Douban submission.
- No login automation.
- No cookie access.
- No CAPTCHA handling.
- No bulk Discogs requests.
- No background crawling.
- No automatic cover upload.
- No default overwrite of existing Douban fields.
- No custom select autofill in v0.1.
- No RYM, AOTY, or Bandcamp network importer or source host permission.
- No Bandcamp commerce, audio, cover URL, recommendation, comment, supporter,
  or user/account data import.
