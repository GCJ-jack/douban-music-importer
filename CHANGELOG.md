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
