import assert from "node:assert/strict";
import test from "node:test";

import { fillDoubanDetailedForm } from "../src/core/douban/douban-form-assistant.js";
import { mapReleaseToDoubanDraft } from "../src/core/mappers/douban-draft-mapper.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  markDraftFieldConfirmed,
} from "../src/core/review/draft-review-state.js";
import { normalizeDiscogsRelease } from "../src/core/normalizers/discogs-release-normalizer.js";
import { validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../src/core/validation/schema-validation.js";
import { discogsReleaseFixtures } from "./fixtures/discogs-release-fixtures.js";

test("v0.1 fixtures cover the expected regression categories", () => {
  assert.equal(discogsReleaseFixtures.length, 5);
  assert.deepEqual(discogsReleaseFixtures.map((fixture) => fixture.name), [
    "standard-cd-release",
    "no-barcode-release",
    "multi-artist-multi-label-vinyl",
    "cjk-special-characters",
    "multi-disc-nested-tracklist",
  ]);

  for (const fixture of discogsReleaseFixtures) {
    assert.equal(typeof fixture.reason, "string");
    assert.ok(fixture.reason.length > 20);
    assert.ok(fixture.expected.title);
    assert.ok(fixture.expected.sourceUrl);
  }
});

for (const fixture of discogsReleaseFixtures) {
  test(`v0.1 import chain regression: ${fixture.name}`, () => {
    const metadata = normalizeDiscogsRelease(source(fixture.raw));
    const metadataValidation = validateAlbumReleaseMetadata(metadata);
    assert.equal(metadataValidation.ok, true);

    const draft = mapReleaseToDoubanDraft(metadata);
    const draftValidation = validateDoubanMusicDraft(draft);
    assert.equal(draftValidation.ok, true);

    assert.equal(metadata.release.title, fixture.expected.title);
    assert.equal(draft.fields.title.value, fixture.expected.title);
    assert.equal(draft.fields.artists.value, fixture.expected.artists);
    assert.equal(draft.fields.releaseDate.value, fixture.expected.releaseDate);
    assert.equal(draft.fields.publisher.value, fixture.expected.publisher);
    assert.equal(draft.fields.tracks.value, fixture.expected.tracks);
    assert.match(draft.fields.externalLinks.value, new RegExp(escapeRegExp(fixture.expected.sourceUrl)));

    const reviewState = confirmAllDraftFields(createDraftReviewState({
      draft,
      warnings: metadata.warnings,
      validation: {
        metadata: metadataValidation,
        draft: draftValidation,
      },
      now: "2026-05-16T00:00:00.000Z",
    }));
    const fillPayload = getFillableDraftFields(reviewState);

    assert.equal(fillPayload.title.value, fixture.expected.title);
    assert.equal(fillPayload.artists.value, fixture.expected.artists);
    assert.equal(fillPayload.releaseDate.value, fixture.expected.releaseDate);
    assert.equal(fillPayload.publisher.value, fixture.expected.publisher);
    assert.equal(fillPayload.tracks.value, fixture.expected.tracks);
    assert.equal(fillPayload.genre, undefined);
    assert.equal(fillPayload.media, undefined);
    assert.equal(fillPayload.coverImageUrl, undefined);
    assert.equal(fillPayload.catalogNumber, undefined);

    const document = detailedFormDocument();
    const fillResult = fillDoubanDetailedForm(fillPayload, {
      document,
      location: doubanLocation(),
    });

    assert.equal(fillResult.ok, true);
    assert.equal(document.one("#p_27").value, fixture.expected.title);
    assert.equal(document.one('input[name="p_48"]').value, fixture.expected.artists);
    assert.equal(document.one("#p_51").value, fixture.expected.releaseDate);
    assert.equal(document.one("#p_50").value, fixture.expected.publisher);
    assert.equal(document.one('textarea[name="p_52_other"]').value, fixture.expected.tracks);
    assert.equal(document.one('textarea[name="p_152_other"]').value, fixture.expected.sourceUrl);
    assert.deepEqual(systemFieldSnapshot(document), defaultSystemFieldSnapshot());
    assert.deepEqual(document.one('input[name="detail_subject_submit"]').events, []);
  });
}

test("v0.1 fill regression protects existing values and reports skippedExistingValue", () => {
  const fixture = discogsReleaseFixtures[0];
  const fillPayload = payloadForFixture(fixture);
  const document = detailedFormDocument();
  document.one("#p_27").value = "Existing Douban Title";
  document.one('textarea[name="p_152_other"]').value = "Existing reference";

  const response = fillDoubanDetailedForm(fillPayload, {
    document,
    location: doubanLocation(),
  });

  assert.equal(response.ok, true);
  assert.equal(document.one("#p_27").value, "Existing Douban Title");
  assert.equal(document.one('textarea[name="p_152_other"]').value, "Existing reference");
  assert.deepEqual(response.result.skippedExistingValue, ["title", "externalLinks"]);
  assert.ok(response.result.filled.includes("artists"));
  assert.ok(response.result.filled.includes("releaseDate"));
});

test("v0.1 fill regression ignores unsupported fields and custom select data", () => {
  const fixture = discogsReleaseFixtures[0];
  const fillPayload = {
    ...payloadForFixture(fixture),
    barcode: draftField("1234567890123"),
    genre: draftField("Rock"),
    media: draftField("CD"),
    coverImageUrl: draftField("https://img.discogs.com/cover.jpg"),
    catalogNumber: draftField("STD-001"),
    unmapped: draftField("raw unmapped data"),
  };
  const document = detailedFormDocument();

  const response = fillDoubanDetailedForm(fillPayload, {
    document,
    location: doubanLocation(),
  });

  assert.deepEqual(response.result.unsupportedField, [
    "barcode",
    "genre",
    "media",
    "coverImageUrl",
    "catalogNumber",
    "unmapped",
  ]);
  assert.deepEqual(systemFieldSnapshot(document), defaultSystemFieldSnapshot());
  assert.equal(document.one('input[name="p_116"]').value, "");
  assert.equal(document.one('input[name="p_57"]').value, "");
  assert.equal(document.one('input[name="p_49"]').value, "");
});

test("v0.1 fill regression does not fill lookup or unsupported pages", () => {
  const fillPayload = payloadForFixture(discogsReleaseFixtures[0]);
  const lookupDocument = new FakeDocument({
    bodyText: "添加新的唱片 唱片名 条形码 下一步 取消 添加无条形码的唱片",
  });
  const unsupportedDocument = detailedFormDocument();

  const lookupResponse = fillDoubanDetailedForm(fillPayload, {
    document: lookupDocument,
    location: doubanLocation(),
  });
  const unsupportedResponse = fillDoubanDetailedForm(fillPayload, {
    document: unsupportedDocument,
    location: { href: "https://music.douban.com/subject/1/" },
  });

  assert.equal(lookupResponse.ok, false);
  assert.equal(lookupResponse.code, "lookupPage");
  assert.deepEqual(lookupResponse.result.filled, []);
  assert.equal(unsupportedResponse.ok, false);
  assert.equal(unsupportedResponse.code, "unsupported");
  assert.deepEqual(unsupportedResponse.result.filled, []);
});

function source(raw) {
  return {
    provider: "discogs",
    sourceType: "release",
    releaseId: String(raw.id),
    apiUrl: `https://api.discogs.com/releases/${raw.id}`,
    pageUrl: raw.uri,
    fetchedAt: "2026-05-16T00:00:00.000Z",
    extractorVersion: "0.1.0",
    raw,
  };
}

function confirmAllDraftFields(state) {
  return Object.keys(state.draft.fields)
    .reduce((next, fieldName) => markDraftFieldConfirmed(next, fieldName), state);
}

function payloadForFixture(fixture) {
  const draft = mapReleaseToDoubanDraft(normalizeDiscogsRelease(source(fixture.raw)));
  return getFillableDraftFields(confirmAllDraftFields(createDraftReviewState({
    draft,
    now: "2026-05-16T00:00:00.000Z",
  })));
}

function detailedFormDocument() {
  return new FakeDocument({
    controls: {
      "#p_27": [input({ id: "p_27", name: "p_27" })],
      'input[name="p_48"]': [
        input({ id: "p_48_0", name: "p_48" }),
        input({ id: "m_48_shadow", name: "m_48", type: "hidden", value: "shadow-should-not-fill" }),
      ],
      "#p_51": [input({ id: "p_51", name: "p_51" })],
      "#p_50": [input({ id: "p_50", name: "p_50" })],
      "#p_55": [input({ id: "p_55", name: "p_55" })],
      "#p_54": [input({ id: "p_54", name: "p_54" })],
      'textarea[name="p_52_other"]': [textarea({ name: "p_52_other" })],
      'textarea[name="p_28_other"]': [textarea({ name: "p_28_other" })],
      'textarea[name="p_152_other"]': [textarea({ name: "p_152_other" })],
      'input[name="detail_subject_submit"]': [
        input({ name: "detail_subject_submit", type: "submit", value: "下一步" }),
      ],
      'input[name="ck"]': [input({ name: "ck", type: "hidden", value: "ck-token" })],
      'input[name="cat"]': [input({ name: "cat", type: "hidden", value: "1003" })],
      'input[name="no_uid"]': [input({ name: "no_uid", type: "hidden", value: "yes" })],
      'input[name="search_text"]': [input({ name: "search_text", type: "hidden", value: "Album" })],
      'input[name="m_48"]': [
        input({ id: "m_48_0", name: "m_48", type: "hidden", value: "system-artist-id" }),
      ],
      'input[name="p_116"]': [input({ name: "p_116", type: "hidden", value: "" })],
      'input[name="p_57"]': [input({ name: "p_57", type: "hidden", value: "" })],
      'input[name="p_49"]': [input({ name: "p_49", type: "hidden", value: "" })],
    },
  });
}

function defaultSystemFieldSnapshot() {
  return {
    ck: "ck-token",
    cat: "1003",
    noUid: "yes",
    searchText: "Album",
    m48: "system-artist-id",
    genre: "",
    albumType: "",
    media: "",
  };
}

function systemFieldSnapshot(document) {
  return {
    ck: document.one('input[name="ck"]').value,
    cat: document.one('input[name="cat"]').value,
    noUid: document.one('input[name="no_uid"]').value,
    searchText: document.one('input[name="search_text"]').value,
    m48: document.one('input[name="m_48"]').value,
    genre: document.one('input[name="p_116"]').value,
    albumType: document.one('input[name="p_57"]').value,
    media: document.one('input[name="p_49"]').value,
  };
}

function draftField(value) {
  return {
    value,
    sourceFields: [],
    confidence: "high",
    needsReview: false,
  };
}

function doubanLocation() {
  return {
    href: "https://music.douban.com/new_subject",
  };
}

function input(options) {
  return new FakeControl("input", options);
}

function textarea(options) {
  return new FakeControl("textarea", options);
}

class FakeDocument {
  constructor(options = {}) {
    this.body = { textContent: options.bodyText || "" };
    this.defaultView = { Event: FakeEvent };
    this.controls = options.controls || {};

    for (const controls of Object.values(this.controls)) {
      for (const control of controls) {
        control.ownerDocument = this;
      }
    }
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return this.controls[selector] || [];
  }

  one(selector) {
    const control = this.querySelector(selector);
    assert.ok(control, `Expected selector ${selector}`);
    return control;
  }
}

class FakeControl {
  constructor(tagName, options = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...options };
    this.type = options.type || (tagName === "input" ? "text" : "");
    this.value = options.value || "";
    this.hidden = Boolean(options.hidden);
    this.disabled = Boolean(options.disabled);
    this.events = [];
    this.ownerDocument = null;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  dispatchEvent(event) {
    this.events.push(event.type);
    return true;
  }
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
