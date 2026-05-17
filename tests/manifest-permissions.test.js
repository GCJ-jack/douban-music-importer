import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("manifest keeps RYM current-page prototype permission boundary narrow", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

  assert.equal(manifest.permissions.includes("scripting"), true);
  assert.equal(manifest.host_permissions.some((permission) => permission.includes("rateyourmusic.com")), false);
  assert.equal(manifest.permissions.includes("cookies"), false);
  assert.equal(manifest.permissions.includes("tabs"), false);
  assert.equal(manifest.permissions.includes("webRequest"), false);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
});
