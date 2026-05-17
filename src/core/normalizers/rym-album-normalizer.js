import {
  RELEASE_METADATA_SCHEMA_VERSION,
  createDatePrecision,
  createImportWarning,
  createSourceInfo,
} from "../schema/release-metadata.js";

export function normalizeRymAlbumExtract(sourceMetadata) {
  const raw = sourceMetadata?.raw || {};
  const warnings = Array.isArray(sourceMetadata?.warnings)
    ? [...sourceMetadata.warnings]
    : [];
  const provenance = {};
  const confidence = {};

  const title = cleanString(raw.title);
  const artist = cleanString(raw.artist);
  const releaseDate = normalizeReleaseDate(raw.releaseDate, warnings);
  const genres = cleanStringArray(raw.genres);
  const descriptors = cleanStringArray(raw.descriptors);
  const tracklist = normalizeTracklist(raw.tracks);
  const sourceUrl = cleanString(raw.sourceUrl) || cleanString(sourceMetadata.pageUrl);

  if (!title) {
    warnings.push(createImportWarning("RYM title is missing.", {
      field: "release.title",
      level: "warning",
    }));
  }

  if (!artist) {
    warnings.push(createImportWarning("RYM artist is missing.", {
      field: "release.artists",
      level: "warning",
    }));
  }

  setField(provenance, confidence, "release.title", ["raw.title"], title ? "medium" : "low");
  setField(provenance, confidence, "release.artists", ["raw.artist"], artist ? "medium" : "low");
  setField(provenance, confidence, "release.releaseDate", ["raw.releaseDate"], releaseDate ? "medium" : "low");
  setField(provenance, confidence, "release.genres", ["raw.genres"], genres.length ? "medium" : "low");
  setField(provenance, confidence, "release.styles", ["raw.descriptors"], descriptors.length ? "medium" : "low");
  setField(provenance, confidence, "release.tracklist", ["raw.tracks"], tracklist.length ? "medium" : "low");
  setField(provenance, confidence, "release.externalUrls", ["raw.sourceUrl"], sourceUrl ? "high" : "low");

  return {
    schemaVersion: RELEASE_METADATA_SCHEMA_VERSION,
    source: createSourceInfo({
      provider: "rym",
      sourceType: "album",
      pageUrl: sourceUrl,
      releaseId: sourceUrl,
      extractorVersion: sourceMetadata.extractorVersion || "0.2.0-prototype",
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
      genres,
      styles: descriptors,
      identifiers: [],
      catalogNumbers: [],
      tracklist,
      credits: [],
      externalUrls: sourceUrl ? [{ provider: "rym", url: sourceUrl }] : [],
    },
    confidence,
    provenance,
    warnings,
  };
}

function normalizeReleaseDate(value, warnings) {
  const raw = cleanString(value);
  if (!raw) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return createDatePrecision(raw, "day");
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return createDatePrecision(raw, "month");
  }

  if (/^\d{4}$/.test(raw)) {
    return createDatePrecision(raw, "year");
  }

  warnings.push(createImportWarning(`Could not normalize RYM release date: ${raw}.`, {
    field: "release.releaseDate",
    level: "warning",
  }));
  return undefined;
}

function normalizeTracklist(tracks) {
  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks
    .map((track) => {
      const value = cleanString(track);
      if (!value) {
        return null;
      }

      const match = value.match(/^([A-Z]?\d{1,3}[.)]?)\s+(.+)$/);
      return {
        position: match ? match[1].replace(/[.)]$/, "") : undefined,
        title: match ? match[2].trim() : value,
      };
    })
    .filter(Boolean);
}

function setField(provenance, confidence, field, sources, level) {
  provenance[field] = sources;
  confidence[field] = level;
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(cleanString).filter(Boolean))];
}
