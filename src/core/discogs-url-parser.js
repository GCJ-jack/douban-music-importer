const SUPPORTED_HOSTS = new Set(["discogs.com", "www.discogs.com"]);

export function parseDiscogsReleaseUrl(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    return {
      supported: false,
      releaseId: null,
      reason: "invalid_url",
    };
  }

  const hostname = url.hostname.toLowerCase();
  if (!SUPPORTED_HOSTS.has(hostname)) {
    return {
      supported: false,
      releaseId: null,
      reason: "unsupported_host",
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const releaseIndex = segments.findIndex((segment) => segment.toLowerCase() === "release");

  if (releaseIndex === -1 || releaseIndex === segments.length - 1) {
    return {
      supported: false,
      releaseId: null,
      reason: "not_release_page",
    };
  }

  const releaseSegment = segments[releaseIndex + 1];
  const match = releaseSegment.match(/^(\d+)(?:$|[-_])/);

  if (!match) {
    return {
      supported: false,
      releaseId: null,
      reason: "missing_release_id",
    };
  }

  return {
    supported: true,
    releaseId: match[1],
    reason: null,
  };
}
