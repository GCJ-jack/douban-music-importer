import assert from "node:assert/strict";
import test from "node:test";

import { DiscogsApiError, fetchDiscogsRelease } from "../src/core/discogs-api-client.js";

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return headers[name] || null;
      },
    },
    async json() {
      return body;
    },
  };
}

test("fetches a single Discogs release by id", async () => {
  const calls = [];
  const metadata = await fetchDiscogsRelease("123456", {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, { id: 123456, title: "Example Release" });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.discogs.com/releases/123456");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(metadata.releaseId, "123456");
  assert.equal(metadata.raw.title, "Example Release");
});

test("maps 404 responses", async () => {
  await assert.rejects(
    fetchDiscogsRelease("123456", {
      fetchImpl: async () => jsonResponse(404, { message: "not found" }),
    }),
    (error) => error instanceof DiscogsApiError && error.code === "not_found",
  );
});

test("maps 429 responses", async () => {
  await assert.rejects(
    fetchDiscogsRelease("123456", {
      fetchImpl: async () => jsonResponse(429, { message: "rate limited" }, { "Retry-After": "60" }),
    }),
    (error) => error instanceof DiscogsApiError && error.code === "rate_limited",
  );
});

test("maps network failures", async () => {
  await assert.rejects(
    fetchDiscogsRelease("123456", {
      fetchImpl: async () => {
        throw new Error("offline");
      },
    }),
    (error) => error instanceof DiscogsApiError && error.code === "network_error",
  );
});
