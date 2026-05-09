import assert from "node:assert/strict";
import test from "node:test";

import { parseDiscogsReleaseUrl } from "../src/core/discogs-url-parser.js";

test("parses canonical Discogs release URLs", () => {
  assert.deepEqual(parseDiscogsReleaseUrl("https://www.discogs.com/release/123456-Artist-Album"), {
    supported: true,
    releaseId: "123456",
    reason: null,
  });
});

test("parses localized Discogs release URLs", () => {
  assert.deepEqual(parseDiscogsReleaseUrl("https://www.discogs.com/ja/release/987654-Artist-Album"), {
    supported: true,
    releaseId: "987654",
    reason: null,
  });
});

test("rejects Discogs master pages", () => {
  assert.equal(parseDiscogsReleaseUrl("https://www.discogs.com/master/123456-Artist-Album").supported, false);
});

test("rejects unsupported hosts", () => {
  assert.equal(parseDiscogsReleaseUrl("https://example.com/release/123456").reason, "unsupported_host");
});
