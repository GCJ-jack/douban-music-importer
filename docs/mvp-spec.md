# douban-music-importer MVP Spec

This document is the project north star for the MVP. Product decisions,
implementation tasks, reviews, documentation, and future roadmap work should
align with it unless a later decision record explicitly changes the direction.

## 1. Project Goal

`douban-music-importer` is a browser extension that helps users import music
album or release metadata from Discogs, Rate Your Music (RYM), and Album of the
Year (AOTY), then assists with filling the Douban Music new-subject form.

The MVP focuses on Discogs release pages. The extension should improve metadata
entry efficiency and quality, while keeping the user fully responsible for
checking, editing, and submitting the Douban entry.

The project is intended to be maintained as a long-term GitHub open source
project, with clear boundaries, conservative permissions, testable metadata
mapping, and contribution-friendly documentation.

## 2. MVP Scope

The MVP supports one primary workflow: importing metadata from a Discogs release
page into a user-reviewable Douban Music draft, then assisting the user with
filling the Douban Music new-subject form.

MVP capabilities:

- Detect supported Discogs release pages.
- Extract core Discogs release metadata:
  - release title
  - release artists
  - release date or year
  - labels
  - country or region
  - media formats
  - track list
  - barcode
  - catalog numbers
  - cover image source URL
  - Discogs source URL
- Normalize the extracted metadata into an internal release model.
- Map the internal release model into a Douban Music draft.
- Show a review UI where users can inspect, edit, remove, and confirm fields.
- Store the current import draft locally for the active import flow.
- Detect the Douban Music new-subject form.
- Fill supported Douban form fields only after explicit user confirmation.
- Preserve source information and mark uncertain fields for review.
- Avoid overwriting existing form input unless the user explicitly confirms it.

## 3. Non-Goals

The MVP must not implement:

- Automatic Douban subject submission.
- Batch creation of Douban subjects.
- Automatic Douban login.
- CAPTCHA handling.
- Any bypass of login, CAPTCHA, review, rate limit, moderation, or community
  rules.
- Background bulk scraping of Douban or source sites.
- RYM import support.
- AOTY import support.
- Complex duplicate detection.
- Release-version merging.
- Authoritative metadata arbitration across multiple sources.
- A backend service.
- User accounts.
- Cloud sync.

RYM and AOTY are roadmap targets. The MVP should leave room for them in the
architecture, but must not depend on implementing them.

## 4. Safety And Compliance Boundaries

The extension is an assisted data-entry tool. It must never behave like an
automated publishing system.

Required boundaries:

- Users must be able to inspect, edit, and confirm every field before it is
  written into the Douban form.
- The extension may fill form fields only after explicit user action.
- The extension must not click the Douban submit button.
- The extension must not bypass login, CAPTCHA, review, rate limits, community
  rules, or access controls.
- The extension must not read or store cookies.
- The extension must not infer or expose Douban login state.
- The extension must not upload browsing data or imported metadata to a third
  party service.
- The extension must not run on unrelated sites.
- Uncertain or lossy mappings must be marked as needing review.
- Cover images should be represented by source URLs or user-facing references;
  the extension should not redistribute copyrighted image files.
- Failure states must be visible and understandable instead of silently filling
  low-confidence data.

Permissions should be minimal. Avoid broad permissions such as `<all_urls>`,
`cookies`, `webRequest`, and network interception unless a future decision
record justifies them.

## 5. Core User Flow

1. The user opens a Discogs release page.
2. The extension detects that the page is supported.
3. The user triggers metadata extraction.
4. The extension extracts and normalizes release metadata.
5. The extension displays a reviewable draft with field sources, confidence,
   and warnings.
6. The user edits, removes, or confirms fields.
7. The extension stores the reviewed draft locally.
8. The user opens the Douban Music new-subject page.
9. The extension detects the form and the existing import draft.
10. The user reviews the draft again and confirms filling.
11. The extension fills supported fields without submitting the form.
12. The user manually checks, edits, and submits through Douban's normal flow.

## 6. Technical Architecture

Use a Manifest V3 browser extension.

Recommended structure:

```text
douban-music-importer/
  manifest.json
  src/
    background/
      service-worker
    content/
      discogs-release-content
      douban-music-form-content
    popup/
      popup-ui
    review/
      import-review-ui
    core/
      extractors/
      normalizers/
      mappers/
      schema/
      validation/
    storage/
      draft-store
      settings-store
```

Primary data flow:

```text
Discogs Release Page
  -> Discogs Content Script
  -> Discogs Extractor
  -> AlbumReleaseMetadata
  -> Douban Mapper
  -> DoubanMusicDraft
  -> Draft Store
  -> Douban Music Form Page
  -> Review UI
  -> user confirmation
  -> form fill
  -> manual user submission
```

Default storage strategy:

- Use session storage for the active import draft when available.
- Use local storage only for explicit user-saved drafts or settings.
- Do not persist imported metadata longer than needed without user intent.

## 7. Module Boundaries

### Discogs Content Script

Responsibilities:

- Run only on supported Discogs release pages.
- Read page data from the DOM, structured data, embedded state, or page URL.
- Return source-specific raw metadata.

Non-responsibilities:

- Do not operate on Douban pages.
- Do not decide Douban field mapping.
- Do not write drafts directly into storage without passing through the core
  pipeline.

### Extractor Layer

Responsibilities:

- Provide source-specific extraction modules.
- MVP module: Discogs release extractor.
- Future modules: RYM extractor and AOTY extractor.
- Output raw source metadata with source context.

Non-responsibilities:

- Do not know Douban form structure.
- Do not perform user-facing field confidence decisions beyond extraction
  evidence.

### Normalizer Layer

Responsibilities:

- Convert source-specific metadata into the shared internal release model.
- Preserve provenance, raw source references, and warnings.
- Normalize dates, artists, labels, formats, identifiers, and track lists.

Non-responsibilities:

- Do not write browser pages.
- Do not submit data.
- Do not make unsupported assumptions for missing fields.

### Douban Mapper

Responsibilities:

- Convert `AlbumReleaseMetadata` into `DoubanMusicDraft`.
- Format fields for Douban Music's new-subject form.
- Mark uncertain mappings as `needsReview`.
- Preserve unmapped data for user inspection.

Non-responsibilities:

- Do not interact with the page directly.
- Do not submit the form.

### Douban Content Script

Responsibilities:

- Run only on supported Douban Music new-subject pages.
- Detect supported form fields.
- Show or connect to the review UI.
- Fill fields only after explicit user confirmation.
- Warn before overwriting existing user input.

Non-responsibilities:

- Do not click submit.
- Do not bypass validation, login, CAPTCHA, moderation, or rate limits.
- Do not inspect cookies or account state.

### Review UI

Responsibilities:

- Show extracted and mapped fields.
- Show source URLs, confidence, and warnings.
- Allow users to edit, remove, and confirm fields.
- Provide a clear action to fill the Douban form.
- Keep low-confidence or lossy mappings visible.

### Draft Store

Responsibilities:

- Store the active import draft for the current workflow.
- Support explicit user-saved drafts later if needed.
- Avoid long-term persistence by default.

## 8. Data Structure Design

The internal model should represent a music release, not only a generic album.
This matches the Discogs MVP source object and leaves room for release-specific
metadata such as country, format, catalog number, and barcode.

```ts
type AlbumReleaseMetadata = {
  schemaVersion: "0.1";
  source: SourceInfo;
  release: {
    title: string;
    subtitle?: string;
    displayTitle?: string;
    artists: ArtistCredit[];
    releaseArtistsText?: string;
    releaseDate?: DatePrecision;
    originalReleaseDate?: DatePrecision;
    country?: string;
    labels: LabelCredit[];
    companies?: CompanyCredit[];
    formats: FormatInfo[];
    genres: string[];
    styles: string[];
    identifiers: Identifier[];
    catalogNumbers: CatalogNumber[];
    tracklist: Track[];
    credits: Credit[];
    notes?: string;
    coverImage?: ImageRef;
    externalUrls: ExternalUrl[];
  };
  confidence: Record<string, "high" | "medium" | "low">;
  provenance: Record<string, string[]>;
  warnings: ImportWarning[];
};
```

```ts
type SourceInfo = {
  provider: "discogs" | "rym" | "aoty";
  sourceType: "release" | "master" | "album" | "review-page";
  url: string;
  id?: string;
  fetchedAt: string;
  extractorVersion: string;
};
```

```ts
type ArtistCredit = {
  name: string;
  role?: "main" | "featuring" | "composer" | "conductor" | "remixer" | "producer" | "other";
  joinPhrase?: string;
  sourceUrl?: string;
};
```

```ts
type DatePrecision = {
  value: string;
  precision: "year" | "month" | "day";
};
```

```ts
type LabelCredit = {
  name: string;
  catalogNumber?: string;
  sourceUrl?: string;
};
```

```ts
type CompanyCredit = {
  name: string;
  role?: string;
  sourceUrl?: string;
};
```

```ts
type FormatInfo = {
  type: "CD" | "Vinyl" | "Cassette" | "Digital" | "File" | "SACD" | "DVD" | "Other";
  quantity?: number;
  descriptions?: string[];
};
```

```ts
type Identifier = {
  type: "Barcode" | "Matrix" | "Rights Society" | "Other";
  value: string;
  description?: string;
};
```

```ts
type CatalogNumber = {
  label?: string;
  value: string;
};
```

```ts
type Track = {
  position?: string;
  title: string;
  duration?: string;
  artists?: ArtistCredit[];
  credits?: Credit[];
  subTracks?: Track[];
};
```

```ts
type Credit = {
  name: string;
  role: string;
  target?: "release" | "track";
  trackPosition?: string;
};
```

```ts
type ImageRef = {
  url: string;
  kind: "cover" | "back" | "media" | "other";
  source: "page" | "api" | "user";
};
```

```ts
type ExternalUrl = {
  provider: "discogs" | "rym" | "aoty" | "official" | "other";
  url: string;
};
```

```ts
type ImportWarning = {
  field?: string;
  level: "info" | "warning" | "error";
  message: string;
};
```

The Douban draft model is separate from the internal metadata model. It
represents fillable form intent, not the source of truth.

```ts
type DoubanMusicDraft = {
  schemaVersion: "0.1";
  sourceUrl: string;
  fields: {
    title?: DraftField<string>;
    originalTitle?: DraftField<string>;
    artists?: DraftField<string>;
    releaseDate?: DraftField<string>;
    publisher?: DraftField<string>;
    media?: DraftField<string>;
    genre?: DraftField<string>;
    barcode?: DraftField<string>;
    catalogNumber?: DraftField<string>;
    tracks?: DraftField<string>;
    summary?: DraftField<string>;
    externalLinks?: DraftField<string>;
    coverImageUrl?: DraftField<string>;
  };
  unmapped: UnmappedField[];
};
```

```ts
type DraftField<T> = {
  value: T;
  sourceFields: string[];
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  note?: string;
};
```

```ts
type UnmappedField = {
  sourceField: string;
  value: unknown;
  reason: string;
};
```

## 9. Field Priority

High-priority MVP fields:

- Release title.
- Release artists.
- Release date or year.
- Labels.
- Media formats.
- Track list.
- Cover image source URL.
- Discogs source URL.

Medium-priority MVP fields:

- Country or region.
- Genres and styles.
- Barcode.
- Catalog numbers.
- Release notes.

Low-priority fields:

- Complete credits.
- Company credits.
- Matrix or runout identifiers.
- Detailed release-version differences.

Low-priority fields may be preserved as unmapped metadata or notes, but should
not block the MVP.

## 10. Permission Strategy

Recommended MVP permissions:

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://www.discogs.com/*",
    "https://discogs.com/*",
    "https://music.douban.com/*"
  ]
}
```

Host permissions should be narrowed later once exact supported URL patterns are
confirmed.

Avoid:

- `<all_urls>`
- `cookies`
- `webRequest`
- `declarativeNetRequest`
- broad background network access

Potential content-script URL patterns to verify during implementation:

```text
Discogs:
  https://www.discogs.com/release/*
  https://www.discogs.com/*/release/*

Douban:
  https://music.douban.com/new_subject*
  https://music.douban.com/subject_create*
```

The Douban URL patterns are open questions until confirmed against the real
form.

## 11. MVP Milestones

### v0.1

- Create the Manifest V3 extension skeleton.
- Detect supported Discogs release pages.
- Extract high-priority Discogs metadata.
- Normalize metadata into `AlbumReleaseMetadata`.
- Map metadata into `DoubanMusicDraft`.
- Provide a review UI for imported fields.
- Fill the Douban Music new-subject form after user confirmation.
- Protect existing form input from accidental overwrite.
- Establish 5 to 10 Discogs regression fixtures.
- Add README, contribution, roadmap, changelog, issue template, and PR template
  foundations.

### v0.2

- Improve Discogs release compatibility.
- Improve multi-disc, multi-format, multi-label, and multi-catalog-number
  handling.
- Add stronger extraction and mapping tests.
- Improve error messages and low-confidence field warnings.

### v0.3

- Support Discogs master pages as an assisted path to choose a specific release.
- Improve draft persistence and review UX.
- Add a release checklist and changelog workflow.

### v0.4

- Research and prototype RYM album-page import.
- Confirm RYM fields, constraints, and service-boundary risks.
- Add cross-site fixture candidates.

### v0.5

- Research and prototype AOTY album-page import.
- Confirm AOTY fields, constraints, and service-boundary risks.
- Add source-priority and source-selection UX only if needed.

### v1.0

- Stabilize the Discogs release to Douban new-subject workflow.
- Support at least one additional source at usable quality, or explicitly
  defer it with documented rationale.
- Maintain a stable regression fixture set.
- Provide clear privacy, permission, contribution, and release documentation.

## 12. QA And Maintenance Requirements

MVP test scenarios:

- Load the extension in a Chromium browser without manifest errors.
- Open a supported Discogs release page and detect it as importable.
- Open Discogs master, artist, label, and unrelated pages without misleading
  import actions.
- Extract title, artists, date, labels, country, formats, identifiers, and
  tracks from a standard Discogs release.
- Preserve special characters, CJK text, accents, punctuation, and parentheses.
- Handle multiple artists, `Various`, artist name variations, and featured
  artists conservatively.
- Preserve multi-label and multi-catalog-number data without silent loss.
- Render multi-disc and side-based vinyl track lists in stable order.
- Keep working when optional fields are missing.
- Detect a Douban Music new-subject form.
- Fill fields only after user confirmation.
- Warn before overwriting existing form values.
- Avoid running on unrelated sites.
- Show understandable errors when extraction or form detection fails.

Recommended MVP fixtures:

- A standard Western CD release.
- A vinyl release with side A and side B.
- A multi-artist compilation.
- A Japanese release with Japanese text.
- A multi-disc or box-set release.
- A release with incomplete Discogs data.
- A release with special characters, remix titles, or featured artists.

Maintenance rules:

- Every real parsing bug should become a fixture or regression test.
- Fixing the Discogs-to-Douban main path has higher priority than adding new
  source sites.
- Permission expansion must be reviewed as a product and privacy decision, not
  only as an implementation detail.
- Mapping changes must be conservative and visible to users.

## 13. README And Open Source Maintenance

README should eventually include:

- Project introduction.
- Current project status.
- Supported and planned sources.
- What the extension will not do.
- Installation instructions.
- Usage instructions.
- Field mapping overview.
- Privacy and permission explanation.
- Known limitations.
- Development and testing instructions.
- Contribution entry point.
- Roadmap.
- License.

Recommended repository documents:

- `README.md`
- `CONTRIBUTING.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/metadata_mapping.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/site_compatibility.md`
- `.github/pull_request_template.md`

Issue templates should collect source URLs, browser and extension versions,
actual versus expected results, screenshots or recordings, console errors, and
whether the example should become a regression fixture.

## 14. Risks And Open Questions

Open questions:

- What are the exact current Douban Music new-subject form URLs?
- What are the real Douban form field names, labels, required fields, and
  validation rules?
- Does Douban support filling a cover image by URL, or must users upload it
  manually?
- Which Discogs page data source is most stable for MVP extraction: DOM,
  JSON-LD, embedded application state, or API?
- If the Discogs API is used later, what token, rate limit, and terms-of-use
  requirements apply?
- What fields can RYM pages expose reliably without login or restricted access?
- What fields can AOTY pages expose reliably without login or restricted access?
- What source-site terms, image rights, and Douban community rules should be
  reflected in project docs?

Known risks:

- Douban form DOM changes may break filling.
- Discogs page structure changes may break extraction.
- Multi-language and multi-artist metadata may map poorly to Douban fields.
- RYM and AOTY may have access restrictions or service-boundary concerns.
- Users may overtrust imported metadata unless the UI clearly emphasizes manual
  review.

## 15. Decision Record

Initial MVP decisions:

- The MVP supports Discogs release pages first.
- The core internal object is a release, not a generic album.
- RYM and AOTY are future sources, not MVP deliverables.
- All automation stops at assisted form filling.
- Users must inspect, edit, and confirm imported fields.
- The extension must never submit a Douban entry.
- Uncertain fields must be visible and marked for review.
- No backend service is required for MVP.
- Local/session storage is preferred for import drafts.
- Stable Discogs-to-Douban behavior is more important than quickly adding new
  source sites.
