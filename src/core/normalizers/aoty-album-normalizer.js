import {
  RELEASE_METADATA_SCHEMA_VERSION,
  createDatePrecision,
  createImportWarning,
  createSourceInfo,
} from "../schema/release-metadata.js";

export function normalizeAotyAlbumPaste(sourceMetadata) {
  const raw = sourceMetadata?.raw || {};
  const warnings = Array.isArray(sourceMetadata?.warnings)
    ? [...sourceMetadata.warnings]
    : [];
  const provenance = {};
  const confidence = {};

  const title = cleanString(raw.title);
  const artist = cleanString(raw.artist);
  const releaseDate = normalizeReleaseDate(raw.releaseDate, warnings);
  const tracklist = normalizeTracklist(raw.tracks);
  const sourceUrl = cleanString(raw.sourceUrl) || cleanString(sourceMetadata.pageUrl);
  const sourceId = cleanString(raw.sourceId) || extractAotyId(sourceUrl);
  const labelNames = cleanStringArray(raw.labels);
  const reviewOnly = {
    genres: cleanStringArray([...(raw.genres || []), ...(raw.tags || [])]),
    labels: [],
    formats: cleanStringArray(raw.formats),
    coverVisible: Boolean(raw.coverVisible),
  };

  if (!title) {
    warnings.push(createImportWarning("AOTY title is missing.", {
      field: "release.title",
      level: "warning",
    }));
  }

  if (!artist) {
    warnings.push(createImportWarning("AOTY artist is missing.", {
      field: "release.artists",
      level: "warning",
    }));
  }

  if (!tracklist.length) {
    warnings.push(createImportWarning("AOTY pasted text did not include a tracklist.", {
      field: "release.tracklist",
      level: "warning",
    }));
  }

  setField(provenance, confidence, "release.title", ["raw.title"], title ? "medium" : "low");
  setField(provenance, confidence, "release.artists", ["raw.artist"], artist ? "medium" : "low");
  setField(provenance, confidence, "release.releaseDate", ["raw.releaseDate"], releaseDate ? "medium" : "low");
  setField(provenance, confidence, "release.tracklist", ["raw.tracks"], tracklist.length ? "medium" : "low");
  setField(provenance, confidence, "release.labels", ["raw.labels"], labelNames.length ? "medium" : "low");
  setField(provenance, confidence, "release.externalUrls", ["raw.sourceUrl"], sourceUrl ? "high" : "low");
  setField(provenance, confidence, "release.reviewOnly", ["raw.genres", "raw.tags", "raw.formats", "raw.coverVisible"], "medium");

  return {
    schemaVersion: RELEASE_METADATA_SCHEMA_VERSION,
    source: createSourceInfo({
      provider: "aoty",
      sourceType: "album",
      sourceMode: sourceMetadata.sourceMode || raw.sourceMode || "",
      pageUrl: sourceUrl,
      releaseId: sourceId || sourceUrl,
      extractorVersion: sourceMetadata.extractorVersion || "0.1.0-prototype",
      fetchedAt: sourceMetadata.fetchedAt,
    }),
    release: {
      title,
      displayTitle: title || undefined,
      artists: artist ? [{ name: artist, role: "main" }] : [],
      releaseDate,
      labels: labelNames.map((name) => ({ name })),
      companies: [],
      formats: [],
      genres: [],
      styles: [],
      identifiers: [],
      catalogNumbers: [],
      tracklist,
      credits: [],
      externalUrls: sourceUrl ? [{ provider: "aoty", url: sourceUrl }] : [],
      reviewOnly,
    },
    confidence,
    provenance,
    warnings: dedupeWarnings(warnings),
  };
}

function normalizeReleaseDate(value, warnings) {
  const raw = cleanString(value);
  if (!raw) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return createDatePrecision(raw, "day");
  if (/^\d{4}-\d{2}$/.test(raw)) return createDatePrecision(raw, "month");
  if (/^\d{4}$/.test(raw)) return createDatePrecision(raw, "year");

  warnings.push(createImportWarning(`Could not normalize AOTY release date: ${raw}.`, {
    field: "release.releaseDate",
    level: "warning",
  }));
  return undefined;
}

function normalizeTracklist(tracks) {
  if (!Array.isArray(tracks)) return [];

  return tracks
    .map((track) => {
      const value = cleanString(track);
      if (!value) return null;
      const match = value.match(/^([A-Z]?\d{1,3}[.)]?)\s+(.+)$/);
      return {
        position: match ? match[1].replace(/[.)]$/, "") : undefined,
        title: match ? match[2].trim() : value,
      };
    })
    .filter(Boolean);
}

function extractAotyId(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    return url.pathname.match(/\/album\/(\d+)-/i)?.[1] || "";
  } catch {
    return "";
  }
}

function setField(provenance, confidence, field, sources, level) {
  provenance[field] = sources;
  confidence[field] = level;
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanStringArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(cleanString).filter(Boolean).filter((value) => value !== "-"))];
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
