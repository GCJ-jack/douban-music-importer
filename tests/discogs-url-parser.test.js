import assert from "node:assert/strict";
import test from "node:test";

import { parseDiscogsReleaseUrl } from "../src/core/discogs-url-parser.js";

test("parses canonical Discogs release URLs", () => {
  assert.deepEqual(parseDiscogsReleaseUrl("https://www.discogs.com/release/123456-Artist-Album"), {
    supported: true,
    releaseId: "123456",
    masterId: null,
    sourceType: "release",
    reason: null,
  });
});

test("parses localized Discogs release URLs", () => {
  assert.deepEqual(parseDiscogsReleaseUrl("https://www.discogs.com/ja/release/987654-Artist-Album"), {
    supported: true,
    releaseId: "987654",
    masterId: null,
    sourceType: "release",
    reason: null,
  });
});

test("parses canonical Discogs master URLs", () => {
  assert.deepEqual(parseDiscogsReleaseUrl("https://www.discogs.com/master/1541661-KirbLaGoop-Trapped-In-Da-100"), {
    supported: true,
    releaseId: null,
    masterId: "1541661",
    sourceType: "master",
    reason: null,
  });
});

test("rejects unsupported hosts", () => {
  assert.equal(parseDiscogsReleaseUrl("https://example.com/release/123456").reason, "unsupported_host");
});
