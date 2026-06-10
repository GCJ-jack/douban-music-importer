import {
  RELEASE_METADATA_SCHEMA_VERSION,
  createDatePrecision,
  createImportWarning,
  createSourceInfo,
} from "../schema/release-metadata.js";

export function normalizeBandcampAlbumExtract(sourceMetadata) {
  const raw = sourceMetadata?.raw || {};
  const warnings = Array.isArray(sourceMetadata?.warnings) ? [...sourceMetadata.warnings] : [];
  const title = cleanString(raw.title);
  const artist = cleanString(raw.artist);
  const releaseDate = normalizeReleaseDate(raw.releaseDate, warnings);
  const tracklist = normalizeTracklist(raw.tracks);
  const sourceUrl = cleanString(raw.sourceUrl) || cleanString(sourceMetadata.pageUrl);
  const reviewOnly = {
    genres: cleanStringArray(raw.tags),
    labels: cleanStringArray(raw.hostingPublishers),
    formats: cleanStringArray(raw.formats),
    coverVisible: Boolean(raw.coverVisible),
  };

  if (!title) warnings.push(createImportWarning("Bandcamp title is missing.", { field: "release.title" }));
  if (!artist) warnings.push(createImportWarning("Bandcamp artist is missing.", { field: "release.artists" }));
  if (!tracklist.length) warnings.push(createImportWarning("Bandcamp current page did not include a tracklist.", { field: "release.tracklist" }));

  return {
    schemaVersion: RELEASE_METADATA_SCHEMA_VERSION,
    source: createSourceInfo({
      provider: "bandcamp",
      sourceType: "album",
      sourceMode: sourceMetadata.sourceMode || raw.sourceMode || "currentPage",
      pageUrl: sourceUrl,
      releaseId: sourceUrl,
      extractorVersion: sourceMetadata.extractorVersion || "0.1.0-prototype",
      fetchedAt: sourceMetadata.fetchedAt,
    }),
    release: {
      title,
      displayTitle: title || undefined,
      artists: artist ? [{ name: artist, role: "main" }] : [],
      releaseDate,
      labels: [],
      companies: [],
      formats: [],
      genres: [],
      styles: [],
      identifiers: [],
      catalogNumbers: [],
      tracklist,
      credits: [],
      externalUrls: sourceUrl ? [{ provider: "bandcamp", url: sourceUrl }] : [],
      reviewOnly,
    },
    confidence: {
      "release.title": title ? "high" : "low",
      "release.artists": artist ? "high" : "low",
      "release.releaseDate": releaseDate ? "high" : "low",
      "release.tracklist": tracklist.length ? "high" : "low",
      "release.externalUrls": sourceUrl ? "high" : "low",
      "release.reviewOnly": "medium",
    },
    provenance: {
      "release.title": ["raw.title"],
      "release.artists": ["raw.artist"],
      "release.releaseDate": ["raw.releaseDate"],
      "release.tracklist": ["raw.tracks"],
      "release.externalUrls": ["raw.sourceUrl"],
      "release.reviewOnly": ["raw.tags", "raw.hostingPublishers", "raw.formats", "raw.coverVisible"],
    },
    warnings: dedupeWarnings(warnings),
  };
}

function normalizeReleaseDate(value, warnings) {
  const raw = cleanString(value);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return createDatePrecision(raw, "day");
  if (/^\d{4}-\d{2}$/.test(raw)) return createDatePrecision(raw, "month");
  if (/^\d{4}$/.test(raw)) return createDatePrecision(raw, "year");
  warnings.push(createImportWarning(`Could not normalize Bandcamp release date: ${raw}.`, {
    field: "release.releaseDate",
  }));
  return undefined;
}

function normalizeTracklist(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks.map((track) => {
    const value = cleanString(track);
    if (!value) return null;
    const match = value.match(/^(\d{1,3}[.)]?)\s+(.+)$/);
    return {
      position: match ? match[1].replace(/[.)]$/, "") : undefined,
      title: match ? match[2].trim() : value,
    };
  }).filter(Boolean);
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanStringArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function dedupeWarnings(warnings) {
  const seen = new Set();
  return warnings.filter((warning) => {
    const key = `${warning.field || ""}:${warning.level || ""}:${warning.message || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
