import { DOUBAN_DRAFT_SCHEMA_VERSION, createDraftField } from "../schema/douban-draft.js";

export function mapReleaseToDoubanDraft(metadata) {
  const release = metadata.release;
  const fields = {};
  const unmapped = [];
  const sourceUrl = metadata.source.url;

  addField(fields, "title", release.title, {
    sourceFields: ["release.title"],
    confidence: confidenceFor(metadata, "release.title"),
  });

  addField(fields, "artists", formatArtists(release.artists), {
    sourceFields: ["release.artists"],
    confidence: confidenceFor(metadata, "release.artists"),
    needsReview: release.artists.length > 1,
    note: release.artists.length > 1 ? "Multiple Discogs artists were merged for Douban draft display." : undefined,
  });

  if (release.releaseDate) {
    addField(fields, "releaseDate", release.releaseDate.value, {
      sourceFields: ["release.releaseDate"],
      confidence: confidenceFor(metadata, "release.releaseDate"),
      needsReview: release.releaseDate.precision !== "day",
      note: release.releaseDate.precision !== "day" ? `Discogs date precision is ${release.releaseDate.precision}.` : undefined,
    });
  }

  addField(fields, "publisher", formatLabels(release.labels), {
    sourceFields: ["release.labels"],
    confidence: confidenceFor(metadata, "release.labels"),
    needsReview: release.labels.length > 1,
    note: release.labels.length > 1 ? "Multiple labels were merged." : undefined,
  });

  addField(fields, "media", formatMedia(release.formats), {
    sourceFields: ["release.formats"],
    confidence: confidenceFor(metadata, "release.formats"),
    needsReview: hasLossyFormatMapping(release.formats),
    note: hasLossyFormatMapping(release.formats) ? "Discogs format descriptions may not match Douban media options exactly." : undefined,
  });

  addField(fields, "genre", formatGenre(release.genres, release.styles), {
    sourceFields: ["release.genres", "release.styles"],
    confidence: minConfidence(confidenceFor(metadata, "release.genres"), confidenceFor(metadata, "release.styles")),
    needsReview: true,
    note: "Discogs genres/styles need manual review against Douban genre options.",
  });

  const barcode = firstIdentifierValue(release.identifiers, "Barcode");
  addField(fields, "barcode", barcode, {
    sourceFields: ["release.identifiers"],
    confidence: barcode ? "high" : "low",
  });

  addField(fields, "catalogNumber", formatCatalogNumbers(release.catalogNumbers), {
    sourceFields: ["release.catalogNumbers"],
    confidence: confidenceFor(metadata, "release.catalogNumbers"),
    needsReview: release.catalogNumbers.length > 1,
    note: release.catalogNumbers.length > 1 ? "Multiple catalog numbers were merged." : undefined,
  });

  addField(fields, "tracks", formatTracks(release.tracklist), {
    sourceFields: ["release.tracklist"],
    confidence: confidenceFor(metadata, "release.tracklist"),
    needsReview: hasNestedTracks(release.tracklist),
    note: hasNestedTracks(release.tracklist) ? "Nested Discogs sub-tracks were flattened for Douban draft display." : undefined,
  });

  addField(fields, "summary", release.notes, {
    sourceFields: ["release.notes"],
    confidence: confidenceFor(metadata, "release.notes"),
    needsReview: Boolean(release.notes),
    note: release.notes ? "Discogs notes may include release-version details; review before using as Douban intro." : undefined,
  });

  addField(fields, "externalLinks", formatExternalLinks(release.externalUrls, sourceUrl), {
    sourceFields: ["source.url", "release.externalUrls"],
    confidence: "high",
  });

  addField(fields, "coverImageUrl", release.coverImage?.url, {
    sourceFields: ["release.coverImage"],
    confidence: confidenceFor(metadata, "release.coverImage"),
    needsReview: Boolean(release.coverImage?.url),
    note: release.coverImage?.url ? "Cover image URL is for review/copy only; v0.1 must not upload it automatically." : undefined,
  });

  collectUnmapped(unmapped, release);

  return {
    schemaVersion: DOUBAN_DRAFT_SCHEMA_VERSION,
    sourceUrl,
    attribution: sourceAttribution(metadata.source),
    fields,
    unmapped,
  };
}

function addField(fields, name, value, options) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  fields[name] = createDraftField(value, {
    sourceFields: options.sourceFields,
    confidence: options.confidence,
    needsReview: options.needsReview || options.confidence === "low",
    note: options.note,
  });
}

function formatArtists(artists) {
  if (!Array.isArray(artists) || artists.length === 0) {
    return "";
  }

  return artists
    .map((artist, index) => {
      const suffix = index < artists.length - 1 ? normalizeJoinPhrase(artist.joinPhrase) : "";
      return `${artist.name}${suffix}`;
    })
    .join("")
    .trim();
}

function normalizeJoinPhrase(joinPhrase) {
  if (!joinPhrase) {
    return " / ";
  }

  if (/^[,&+]$/.test(joinPhrase)) {
    return ` ${joinPhrase} `;
  }

  return joinPhrase.endsWith(" ") ? joinPhrase : `${joinPhrase} `;
}

function formatLabels(labels) {
  return labels.map((label) => label.name).filter(Boolean).join("; ");
}

function formatMedia(formats) {
  return formats
    .map((format) => {
      const quantity = format.quantity && format.quantity > 1 ? `${format.quantity} x ` : "";
      const descriptions = format.descriptions?.length ? ` (${format.descriptions.join(", ")})` : "";
      return `${quantity}${format.type}${descriptions}`;
    })
    .join("; ");
}

function formatGenre(genres, styles) {
  return [...genres, ...styles].filter(Boolean).join("; ");
}

function formatCatalogNumbers(catalogNumbers) {
  return catalogNumbers
    .map((catalogNumber) => catalogNumber.label ? `${catalogNumber.label}: ${catalogNumber.value}` : catalogNumber.value)
    .join("; ");
}

function formatTracks(tracklist) {
  return flattenTracks(tracklist)
    .map((track) => track.position ? `${track.position} ${track.title}` : track.title)
    .join("\n");
}

function flattenTracks(tracklist) {
  return tracklist.flatMap((track) => [track, ...flattenTracks(track.subTracks || [])]);
}

function formatExternalLinks(externalUrls, fallbackUrl) {
  const urls = externalUrls.map((link) => link.url).filter(Boolean);
  if (fallbackUrl && !urls.includes(fallbackUrl)) {
    urls.unshift(fallbackUrl);
  }
  return urls.join("\n");
}

function sourceAttribution(source) {
  if (source?.provider === "rym") {
    return "Metadata extracted from the current Rate Your Music album page. Please review before submitting to Douban.";
  }

  return `Metadata imported from Discogs release ${source?.id || ""}. Please review before submitting to Douban.`;
}

function firstIdentifierValue(identifiers, type) {
  return identifiers.find((identifier) => identifier.type === type)?.value || "";
}

function confidenceFor(metadata, field) {
  return metadata.confidence?.[field] || "medium";
}

function minConfidence(...levels) {
  if (levels.includes("low")) return "low";
  if (levels.includes("medium")) return "medium";
  return "high";
}

function hasLossyFormatMapping(formats) {
  return formats.some((format) => format.type === "Other" || (format.descriptions?.length || 0) > 0);
}

function hasNestedTracks(tracklist) {
  return tracklist.some((track) => track.subTracks?.length || false);
}

function collectUnmapped(unmapped, release) {
  if (release.country) {
    unmapped.push({
      sourceField: "release.country",
      value: release.country,
      reason: "Douban draft schema has no dedicated country field in v0.1.",
    });
  }

  if (release.companies?.length) {
    unmapped.push({
      sourceField: "release.companies",
      value: release.companies,
      reason: "Company credits are review-only for v0.1.",
    });
  }

  const nonBarcodeIdentifiers = release.identifiers.filter((identifier) => identifier.type !== "Barcode");
  if (nonBarcodeIdentifiers.length) {
    unmapped.push({
      sourceField: "release.identifiers",
      value: nonBarcodeIdentifiers,
      reason: "Only Barcode has a dedicated Douban draft field in v0.1.",
    });
  }

  if (release.credits?.length) {
    unmapped.push({
      sourceField: "release.credits",
      value: release.credits,
      reason: "Detailed credits are out of scope for v0.1 Douban draft fields.",
    });
  }
}
