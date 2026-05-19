const SUPPORTED_HOSTS = new Set(["discogs.com", "www.discogs.com"]);

export function parseDiscogsReleaseUrl(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    return {
      supported: false,
      releaseId: null,
      masterId: null,
      sourceType: null,
      reason: "invalid_url",
    };
  }

  const hostname = url.hostname.toLowerCase();
  if (!SUPPORTED_HOSTS.has(hostname)) {
    return {
      supported: false,
      releaseId: null,
      masterId: null,
      sourceType: null,
      reason: "unsupported_host",
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const releaseIndex = segments.findIndex((segment) => segment.toLowerCase() === "release");
  const masterIndex = segments.findIndex((segment) => segment.toLowerCase() === "master");

  if ((releaseIndex === -1 || releaseIndex === segments.length - 1)
    && (masterIndex === -1 || masterIndex === segments.length - 1)) {
    return {
      supported: false,
      releaseId: null,
      masterId: null,
      sourceType: null,
      reason: "not_discogs_release_or_master_page",
    };
  }

  const sourceType = releaseIndex !== -1 ? "release" : "master";
  const idSegment = segments[(sourceType === "release" ? releaseIndex : masterIndex) + 1];
  const match = idSegment.match(/^(\d+)(?:$|[-_])/);

  if (!match) {
    return {
      supported: false,
      releaseId: null,
      masterId: null,
      sourceType,
      reason: sourceType === "release" ? "missing_release_id" : "missing_master_id",
    };
  }

  return {
    supported: true,
    releaseId: sourceType === "release" ? match[1] : null,
    masterId: sourceType === "master" ? match[1] : null,
    sourceType,
    reason: null,
  };
}
