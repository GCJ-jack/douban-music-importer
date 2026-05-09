export class DiscogsApiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DiscogsApiError";
    this.code = code;
    this.details = details;
  }
}

export async function fetchDiscogsRelease(releaseId, options = {}) {
  if (!/^\d+$/.test(String(releaseId))) {
    throw new DiscogsApiError("invalid_release_id", "Release id must be numeric.");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const apiUrl = `https://api.discogs.com/releases/${releaseId}`;

  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.discogs.v2.discogs+json",
      },
    });
  } catch (error) {
    throw new DiscogsApiError("network_error", "Unable to reach Discogs API.", {
      cause: error instanceof Error ? error.message : String(error),
      apiUrl,
    });
  }

  if (response.status === 404) {
    throw new DiscogsApiError("not_found", "Discogs release was not found.", {
      status: response.status,
      apiUrl,
    });
  }

  if (response.status === 429) {
    throw new DiscogsApiError("rate_limited", "Discogs API rate limit was reached.", {
      status: response.status,
      apiUrl,
      retryAfter: response.headers?.get?.("Retry-After") || null,
    });
  }

  if (!response.ok) {
    throw new DiscogsApiError("http_error", `Discogs API returned HTTP ${response.status}.`, {
      status: response.status,
      apiUrl,
    });
  }

  let raw;
  try {
    raw = await response.json();
  } catch (error) {
    throw new DiscogsApiError("invalid_json", "Discogs API returned invalid JSON.", {
      cause: error instanceof Error ? error.message : String(error),
      apiUrl,
    });
  }

  if (!raw || typeof raw !== "object") {
    throw new DiscogsApiError("empty_response", "Discogs API returned an empty response.", {
      apiUrl,
    });
  }

  return {
    provider: "discogs",
    sourceType: "release",
    releaseId: String(releaseId),
    apiUrl,
    fetchedAt: new Date().toISOString(),
    raw,
  };
}
