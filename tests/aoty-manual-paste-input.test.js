import assert from "node:assert/strict";
import test from "node:test";

import {
  AOTY_MANUAL_PASTE_INPUT_KEY,
  clearAotyManualPasteInputDraft,
  createAotyManualPasteInputDraft,
  isAotyAlbumUrl,
  loadAotyManualPasteInputDraft,
  saveAotyManualPasteInputDraft,
} from "../src/popup/aoty-manual-paste-input.js";

function createStorageArea(initial = {}) {
  const store = { ...initial };
  return {
    store,
    async get(key) {
      return { [key]: store[key] };
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(key) {
      delete store[key];
    },
  };
}

test("detects supported AOTY album URLs without accepting other pages", () => {
  assert.equal(
    isAotyAlbumUrl("https://www.albumoftheyear.org/album/1998-kanye-west-my-beautiful-dark-twisted-fantasy.php"),
    true,
  );
  assert.equal(
    isAotyAlbumUrl("https://albumoftheyear.org/album/1792171-vince-staples-cry-baby.php"),
    true,
  );
  assert.equal(isAotyAlbumUrl("https://www.albumoftheyear.org/artist/1-test.php"), false);
  assert.equal(isAotyAlbumUrl("https://rateyourmusic.com/release/album/artist/title/"), false);
  assert.equal(isAotyAlbumUrl("not a url"), false);
});

test("normalizes AOTY manual paste input draft values", () => {
  assert.deepEqual(
    createAotyManualPasteInputDraft({
      sourceUrl: "  https://www.albumoftheyear.org/album/1998-test.php  ",
      text: " pasted text ",
    }),
    {
      sourceUrl: "https://www.albumoftheyear.org/album/1998-test.php",
      text: " pasted text ",
    },
  );
});

test("saves, loads, and clears AOTY manual paste input draft", async () => {
  const storageArea = createStorageArea();

  assert.equal(await saveAotyManualPasteInputDraft(storageArea, {
    sourceUrl: "https://www.albumoftheyear.org/album/1998-test.php",
    text: "visible text",
  }), true);
  assert.deepEqual(storageArea.store[AOTY_MANUAL_PASTE_INPUT_KEY], {
    sourceUrl: "https://www.albumoftheyear.org/album/1998-test.php",
    text: "visible text",
  });

  const loaded = await loadAotyManualPasteInputDraft(storageArea);
  assert.deepEqual(loaded, {
    sourceUrl: "https://www.albumoftheyear.org/album/1998-test.php",
    text: "visible text",
  });

  assert.equal(await clearAotyManualPasteInputDraft(storageArea), true);
  assert.equal(storageArea.store[AOTY_MANUAL_PASTE_INPUT_KEY], undefined);
});

test("AOTY manual paste input draft helpers no-op without session storage", async () => {
  assert.deepEqual(await loadAotyManualPasteInputDraft(null), {
    sourceUrl: "",
    text: "",
  });
  assert.equal(await saveAotyManualPasteInputDraft(null, {
    sourceUrl: "https://www.albumoftheyear.org/album/1998-test.php",
    text: "visible text",
  }), false);
  assert.equal(await clearAotyManualPasteInputDraft(null), false);
});
