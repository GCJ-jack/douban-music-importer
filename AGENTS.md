# Repository Guidelines

## Project Structure & Module Organization

This is a Chrome Manifest V3 extension for importing music metadata into a reviewable Douban draft. Core code lives under `src/`:

- `src/background/`: extension service worker and message flow.
- `src/content/`: page detection and Douban form assistant entry points.
- `src/core/`: provider parsers, normalizers, mappers, schemas, validation, and review logic.
- `src/popup/`: popup UI and user interaction.
- `src/storage/`: local/session draft and raw source storage.
- `tests/`: Node test files and fixtures.
- `docs/`: research, roadmap, QA, privacy, and permission notes.

Keep provider-specific code grouped by source, for example `src/core/aoty/` or `src/core/rym/`.

## Build, Test, and Development Commands

- `npm test`: runs the full Node test suite with `node --test`.
- `node --test tests/<file>.test.js`: runs a focused test file.
- `node --check <file.js>`: checks JavaScript syntax without executing.
- `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"`: validates `manifest.json`.

There is no build step. Load the repository root directly in Chrome via `chrome://extensions` as an unpacked extension.

## Coding Style & Naming Conventions

Use ES modules, two-space indentation, and small focused functions. Prefer descriptive file names such as `aoty-current-page-extractor.js` and test names such as `aoty-current-page-extractor.test.js`. Keep comments short and only where they clarify non-obvious parsing or safety decisions.

Avoid broad refactors while changing provider behavior. Preserve existing schemas and mapper contracts unless the issue explicitly changes them.

## Testing Guidelines

Tests use Node’s built-in test runner and `node:assert/strict`. Add regression tests for every parser, mapper, review-state, storage, or form-fill behavior change. For real page variants, add minimal stable fixtures that capture the field shape and noise filtering requirements.

Before submitting changes, run `npm test` and relevant `node --check` commands for touched JS files.

## Commit & Pull Request Guidelines

Use concise conventional-style commits seen in history, for example:

- `feat: add AOTY current-page extractor`
- `docs: add Bandcamp feasibility research`
- `fix: clean RYM tracklist variants`

PRs should link the relevant GitHub issue, summarize behavior changes, list tests run, and call out any permission, network, storage, or Douban form-fill impact.

## Security & Extension Boundaries

Do not add `cookies`, `<all_urls>`, broad host permissions, background crawling, automatic submission, login/CAPTCHA handling, or cover/audio reuse. Source data must enter the review UI before safe-fill. Douban filling must remain user-confirmed, no-overwrite by default, and limited to supported safe fields unless a separate issue approves custom select handling.

RYM, AOTY, and Bandcamp source work must stay user-initiated and current-page/local only unless a separate issue changes that boundary: no source-page fetches, network importers, crawling, pagination, bulk access, cookies, login/CAPTCHA/Cloudflare handling, or cover/audio reuse.
