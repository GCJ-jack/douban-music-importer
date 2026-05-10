import {
  RELEASE_METADATA_SCHEMA_VERSION,
  createDatePrecision,
  createImportWarning,
  createSourceInfo,
} from "../schema/release-metadata.js";

export function normalizeDiscogsRelease(sourceMetadata) {
  const raw = sourceMetadata?.raw || {};
  const warnings = [];
  const provenance = {};
  const confidence = {};

  const title = cleanString(raw.title);
  if (!title) {
    warnings.push(createImportWarning("Discogs release title is missing.", {
      field: "release.title",
      level: "error",
    }));
  }

  const artists = normalizeArtists(raw.artists, "main");
  if (artists.length === 0) {
    warnings.push(createImportWarning("Discogs release artists are missing.", {
      field: "release.artists",
      level: "warning",
    }));
  }

  const labels = normalizeLabels(raw.labels);
  const formats = normalizeFormats(raw.formats, warnings);
  const identifiers = normalizeIdentifiers(raw.identifiers);
  const tracklist = normalizeTracklist(raw.tracklist);
  const releaseDate = normalizeReleaseDate(raw, warnings);
  const coverImage = normalizeCoverImage(raw.images);
  const discogsUrl = sourceMetadata.pageUrl || raw.uri || "";

  setField(provenance, confidence, "release.title", ["raw.title"], title ? "high" : "low");
  setField(provenance, confidence, "release.artists", ["raw.artists"], artists.length ? "high" : "low");
  setField(provenance, confidence, "release.releaseDate", dateSources(raw), releaseDate ? "high" : "low");
  setField(provenance, confidence, "release.labels", ["raw.labels"], labels.length ? "high" : "low");
  setField(provenance, confidence, "release.formats", ["raw.formats"], formats.length ? "high" : "low");
  setField(provenance, confidence, "release.genres", ["raw.genres"], Array.isArray(raw.genres) ? "high" : "low");
  setField(provenance, confidence, "release.styles", ["raw.styles"], Array.isArray(raw.styles) ? "high" : "low");
  setField(provenance, confidence, "release.identifiers", ["raw.identifiers"], identifiers.length ? "high" : "medium");
  setField(provenance, confidence, "release.catalogNumbers", ["raw.labels.catno"], labels.some((label) => label.catalogNumber) ? "high" : "medium");
  setField(provenance, confidence, "release.tracklist", ["raw.tracklist"], tracklist.length ? "high" : "low");
  setField(provenance, confidence, "release.notes", ["raw.notes"], cleanString(raw.notes) ? "medium" : "low");
  setField(provenance, confidence, "release.coverImage", ["raw.images"], coverImage ? "medium" : "low");

  return {
    schemaVersion: RELEASE_METADATA_SCHEMA_VERSION,
    source: createSourceInfo(sourceMetadata),
    release: {
      title: title || "",
      displayTitle: title || undefined,
      artists,
      releaseDate,
      country: cleanString(raw.country) || undefined,
      labels,
      companies: normalizeCompanies(raw.companies),
      formats,
      genres: cleanStringArray(raw.genres),
      styles: cleanStringArray(raw.styles),
      identifiers,
      catalogNumbers: labels
        .filter((label) => label.catalogNumber)
        .map((label) => ({ label: label.name, value: label.catalogNumber })),
      tracklist,
      credits: normalizeCredits(raw.extraartists, "release"),
      notes: cleanString(raw.notes) || undefined,
      coverImage,
      externalUrls: discogsUrl ? [{ provider: "discogs", url: discogsUrl }] : [],
    },
    confidence,
    provenance,
    warnings,
  };
}

function normalizeArtists(rawArtists, role) {
  if (!Array.isArray(rawArtists)) {
    return [];
  }

  return rawArtists
    .map((artist) => {
      const name = cleanString(artist?.anv) || cleanString(artist?.name);
      if (!name) {
        return null;
      }

      return {
        name,
        role,
        joinPhrase: cleanString(artist?.join) || undefined,
        sourceUrl: cleanString(artist?.resource_url) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeLabels(rawLabels) {
  if (!Array.isArray(rawLabels)) {
    return [];
  }

  return rawLabels
    .map((label) => {
      const name = cleanString(label?.name);
      if (!name) {
        return null;
      }

      const catalogNumber = cleanCatalogNumber(label?.catno);
      return {
        name,
        catalogNumber,
        sourceUrl: cleanString(label?.resource_url) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeCompanies(rawCompanies) {
  if (!Array.isArray(rawCompanies)) {
    return [];
  }

  return rawCompanies
    .map((company) => {
      const name = cleanString(company?.name);
      if (!name) {
        return null;
      }

      return {
        name,
        role: cleanString(company?.entity_type_name) || undefined,
        sourceUrl: cleanString(company?.resource_url) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeFormats(rawFormats, warnings) {
  if (!Array.isArray(rawFormats)) {
    return [];
  }

  return rawFormats
    .map((format) => {
      const type = mapFormatType(format?.name);
      const quantity = parsePositiveInteger(format?.qty);
      const descriptions = cleanStringArray(format?.descriptions);

      if (type === "Other" && cleanString(format?.name)) {
        warnings.push(createImportWarning(`Unmapped Discogs format: ${format.name}.`, {
          field: "release.formats",
          level: "warning",
        }));
      }

      return {
        type,
        quantity,
        descriptions,
      };
    })
    .filter((format) => format.type !== "Other" || format.descriptions.length > 0 || format.quantity);
}

function normalizeIdentifiers(rawIdentifiers) {
  if (!Array.isArray(rawIdentifiers)) {
    return [];
  }

  return rawIdentifiers
    .map((identifier) => {
      const value = cleanString(identifier?.value);
      if (!value) {
        return null;
      }

      return {
        type: mapIdentifierType(identifier?.type),
        value,
        description: cleanString(identifier?.description) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeTracklist(rawTracklist) {
  if (!Array.isArray(rawTracklist)) {
    return [];
  }

  return rawTracklist
    .map((track) => {
      const title = cleanString(track?.title);
      if (!title) {
        return null;
      }

      return {
        position: cleanString(track?.position) || undefined,
        title,
        duration: cleanString(track?.duration) || undefined,
        artists: normalizeArtists(track?.artists, "main"),
        credits: normalizeCredits(track?.extraartists, "track", cleanString(track?.position)),
        subTracks: normalizeTracklist(track?.sub_tracks),
      };
    })
    .filter(Boolean);
}

function normalizeCredits(rawCredits, target, trackPosition) {
  if (!Array.isArray(rawCredits)) {
    return [];
  }

  return rawCredits
    .map((credit) => {
      const name = cleanString(credit?.anv) || cleanString(credit?.name);
      const role = cleanString(credit?.role);
      if (!name || !role) {
        return null;
      }

      return {
        name,
        role,
        target,
        trackPosition: trackPosition || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeReleaseDate(raw, warnings) {
  const released = cleanString(raw.released);
  if (released) {
    const normalized = parseDatePrecision(released);
    if (normalized) {
      return normalized;
    }

    warnings.push(createImportWarning(`Could not normalize Discogs released value: ${released}.`, {
      field: "release.releaseDate",
      level: "warning",
    }));
  }

  const year = parsePositiveInteger(raw.year);
  if (year) {
    return createDatePrecision(String(year), "year");
  }

  return undefined;
}

function parseDatePrecision(value) {
  const dayMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch && dayMatch[2] !== "00" && dayMatch[3] !== "00") {
    return createDatePrecision(value, "day");
  }

  const monthMatch = value.match(/^(\d{4})-(\d{2})(?:-00)?$/);
  if (monthMatch && monthMatch[2] !== "00") {
    return createDatePrecision(`${monthMatch[1]}-${monthMatch[2]}`, "month");
  }

  const yearMatch = value.match(/^(\d{4})(?:-00-00)?$/);
  if (yearMatch) {
    return createDatePrecision(yearMatch[1], "year");
  }

  return null;
}

function normalizeCoverImage(rawImages) {
  if (!Array.isArray(rawImages)) {
    return undefined;
  }

  const primary = rawImages.find((image) => image?.type === "primary") || rawImages[0];
  const url = cleanString(primary?.uri) || cleanString(primary?.resource_url);
  if (!url) {
    return undefined;
  }

  return {
    url,
    kind: primary?.type === "primary" ? "cover" : "other",
    source: "api",
  };
}

function mapFormatType(value) {
  const normalized = cleanString(value).toLowerCase();
  if (normalized === "cd") return "CD";
  if (normalized === "vinyl") return "Vinyl";
  if (normalized === "cassette") return "Cassette";
  if (normalized === "file") return "File";
  if (normalized === "sacd") return "SACD";
  if (normalized === "dvd") return "DVD";
  if (["digital", "digital file"].includes(normalized)) return "Digital";
  return "Other";
}

function mapIdentifierType(value) {
  const normalized = cleanString(value).toLowerCase();
  if (normalized === "barcode") return "Barcode";
  if (normalized.includes("matrix")) return "Matrix";
  if (normalized === "rights society") return "Rights Society";
  return "Other";
}

function setField(provenance, confidence, field, sourceFields, level) {
  provenance[field] = sourceFields.filter(Boolean);
  confidence[field] = level;
}

function dateSources(raw) {
  return raw.released ? ["raw.released"] : ["raw.year"];
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(values) {
  return Array.isArray(values) ? values.map(cleanString).filter(Boolean) : [];
}

function cleanCatalogNumber(value) {
  const catalogNumber = cleanString(value);
  if (!catalogNumber || ["none", "n/a", "na"].includes(catalogNumber.toLowerCase())) {
    return undefined;
  }
  return catalogNumber;
}

function parsePositiveInteger(value) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}
