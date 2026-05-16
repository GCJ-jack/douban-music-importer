import assert from "node:assert/strict";
import test from "node:test";

import {
  detectDoubanNewSubjectPage,
  fillDoubanDetailedForm,
} from "../src/core/douban/douban-form-assistant.js";

test("detects Douban detailed new-subject form", () => {
  const document = detailedFormDocument();

  const page = detectDoubanNewSubjectPage(document, doubanLocation());

  assert.deepEqual(page, {
    state: "detailedForm",
    reason: "detailed_form_fields_present",
  });
});

test("detects Douban lookup duplicate-check page", () => {
  const document = new FakeDocument({
    bodyText: "添加新的唱片 唱片名 条形码 下一步 取消 添加无条形码的唱片",
  });

  const page = detectDoubanNewSubjectPage(document, doubanLocation());

  assert.deepEqual(page, {
    state: "lookupPage",
    reason: "lookup_fields_present",
  });
});

test("rejects unsupported pages", () => {
  const document = detailedFormDocument();

  const page = detectDoubanNewSubjectPage(document, {
    href: "https://music.douban.com/subject/123/",
  });

  assert.deepEqual(page, {
    state: "unsupported",
    reason: "unsupported_url",
  });
});

test("fills only safe text inputs and textareas from fill payload", () => {
  const document = detailedFormDocument();

  const response = fillDoubanDetailedForm({
    title: draftField("Album"),
    artists: draftField("Artist A / Artist B"),
    releaseDate: draftField("2024-05-01"),
    publisher: draftField("Label"),
    discCount: draftField("2"),
    isrc: draftField("ISRC-1"),
    tracks: draftField("1 Intro\n2 Song"),
    summary: draftField("Notes"),
    externalLinks: draftField("https://www.discogs.com/release/1-Test"),
  }, {
    document,
    location: doubanLocation(),
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.result.filled, [
    "title",
    "artists",
    "releaseDate",
    "publisher",
    "discCount",
    "isrc",
    "tracks",
    "summary",
    "externalLinks",
  ]);
  assert.equal(document.one("#p_27").value, "Album");
  assert.equal(document.one('input[name="p_48"]').value, "Artist A / Artist B");
  assert.equal(document.one("#p_51").value, "2024-05-01");
  assert.equal(document.one("#p_50").value, "Label");
  assert.equal(document.one("#p_55").value, "2");
  assert.equal(document.one("#p_54").value, "ISRC-1");
  assert.equal(document.one('textarea[name="p_52_other"]').value, "1 Intro\n2 Song");
  assert.equal(document.one('textarea[name="p_28_other"]').value, "Notes");
  assert.equal(document.one('textarea[name="p_152_other"]').value, "https://www.discogs.com/release/1-Test");
});

test("does not overwrite existing values", () => {
  const document = detailedFormDocument();
  document.one("#p_27").value = "Existing title";

  const response = fillDoubanDetailedForm({
    title: draftField("New title"),
    publisher: draftField("Label"),
  }, {
    document,
    location: doubanLocation(),
  });

  assert.equal(document.one("#p_27").value, "Existing title");
  assert.deepEqual(response.result.skippedExistingValue, ["title"]);
  assert.deepEqual(response.result.filled, ["publisher"]);
});

test("leaves hidden system fields and submit control untouched", () => {
  const document = detailedFormDocument();
  const systemBefore = systemFieldSnapshot(document);
  const submit = document.one('input[name="detail_subject_submit"]');

  const response = fillDoubanDetailedForm({
    title: draftField("Album"),
    artists: draftField("Artist"),
    externalLinks: draftField("https://www.discogs.com/release/1-Test"),
  }, {
    document,
    location: doubanLocation(),
  });

  assert.equal(response.ok, true);
  assert.deepEqual(systemFieldSnapshot(document), systemBefore);
  assert.equal(submit.value, "下一步");
  assert.deepEqual(submit.events, []);
});

test("ignores unsupported and review-only fields", () => {
  const document = detailedFormDocument();

  const response = fillDoubanDetailedForm({
    title: draftField("Album"),
    barcode: draftField("1234567890"),
    genre: draftField("Jazz"),
    media: draftField("CD"),
    coverImageUrl: draftField("https://img.discogs.com/cover.jpg"),
    catalogNumber: draftField("CAT-1"),
    unmapped: draftField("raw"),
  }, {
    document,
    location: doubanLocation(),
  });

  assert.equal(document.one("#p_27").value, "Album");
  assert.deepEqual(response.result.filled, ["title"]);
  assert.deepEqual(response.result.unsupportedField, [
    "barcode",
    "genre",
    "media",
    "coverImageUrl",
    "catalogNumber",
    "unmapped",
  ]);
});

test("does not fill on lookup page", () => {
  const document = new FakeDocument({
    bodyText: "添加新的唱片 唱片名 条形码 添加无条形码的唱片",
  });

  const response = fillDoubanDetailedForm({
    title: draftField("Album"),
  }, {
    document,
    location: doubanLocation(),
  });

  assert.equal(response.ok, false);
  assert.equal(response.code, "lookupPage");
  assert.deepEqual(response.result.filled, []);
});

function detailedFormDocument() {
  return new FakeDocument({
    controls: {
      "#p_27": [input({ id: "p_27", name: "p_27" })],
      'input[name="p_48"]': [
        input({ id: "p_48_0", name: "p_48" }),
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
    this.title = options.title || "新添唱片";
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
