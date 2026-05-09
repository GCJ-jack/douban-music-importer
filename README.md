# douban-music-importer

`douban-music-importer` is a browser extension project for helping users import
music album or release metadata from external music databases and use it to fill
Douban Music new-subject forms.

The goal is assisted data entry: the extension should make metadata collection
and form filling easier, while keeping the user in control of review, editing,
and final submission.

## Status

Planning / pre-alpha.

There is no usable extension build yet. The current project focus is defining
the MVP, architecture, safety boundaries, and long-term maintenance direction.

See the full MVP spec: [docs/mvp-spec.md](docs/mvp-spec.md).

## MVP Focus

The first MVP will support Discogs release pages.

Planned MVP workflow:

1. Open a Discogs release page.
2. Extract core release metadata, such as title, artists, release date, label,
   format, track list, barcode, catalog number, cover source URL, and source
   URL.
3. Review and edit the imported draft in the extension.
4. Open the Douban Music new-subject form.
5. Fill supported fields only after explicit user confirmation.
6. Manually review and submit through Douban's normal flow.

RYM and AOTY support are future roadmap items, not part of the first MVP.

## Safety Boundaries

This project will not:

- Automatically submit Douban entries.
- Batch-create Douban entries.
- Log in to Douban for the user.
- Handle or bypass CAPTCHA.
- Bypass review, rate limits, moderation, community rules, or access controls.
- Upload user browsing data or imported metadata to a third-party service.

Users must be able to inspect, edit, and confirm all fields before anything is
written into the Douban form.

## Development Roadmap

- `v0.1`: Discogs release page import, reviewable draft, assisted Douban form
  filling, basic fixtures and documentation.
- `v0.2`: Better Discogs compatibility, stronger parsing tests, clearer error
  handling.
- `v0.3`: Discogs master-page assisted release selection and improved draft UX.
- `v0.4`: Research and prototype RYM import.
- `v0.5`: Research and prototype AOTY import.
- `v1.0`: Stable main workflow, documented permissions and privacy model,
  regression fixtures, and contributor workflow.

## Contributing

The project is not ready for broad feature contributions yet. Early discussion,
metadata mapping examples, Discogs fixture candidates, and safety review are
welcome once issue templates and contribution docs are added.
