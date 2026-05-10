export const RELEASE_METADATA_SCHEMA_VERSION = "0.1";

export const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low"]);
export const WARNING_LEVELS = Object.freeze(["info", "warning", "error"]);

export function createImportWarning(message, options = {}) {
  return {
    field: options.field,
    level: options.level || "warning",
    message,
  };
}

export function createDatePrecision(value, precision) {
  return {
    value,
    precision,
  };
}

export function createSourceInfo(sourceMetadata) {
  return {
    provider: "discogs",
    sourceType: "release",
    url: sourceMetadata.pageUrl || sourceMetadata.raw?.uri || "",
    id: String(sourceMetadata.releaseId || sourceMetadata.raw?.id || ""),
    apiUrl: sourceMetadata.apiUrl || "",
    fetchedAt: sourceMetadata.fetchedAt || new Date().toISOString(),
    extractorVersion: sourceMetadata.extractorVersion || "0.1.0",
  };
}

/**
 * @typedef {"high" | "medium" | "low"} ConfidenceLevel
 * @typedef {"info" | "warning" | "error"} WarningLevel
 *
 * @typedef {Object} SourceInfo
 * @property {"discogs"} provider
 * @property {"release"} sourceType
 * @property {string} url
 * @property {string} id
 * @property {string} apiUrl
 * @property {string} fetchedAt
 * @property {string} extractorVersion
 *
 * @typedef {Object} ArtistCredit
 * @property {string} name
 * @property {"main" | "featuring" | "composer" | "conductor" | "remixer" | "producer" | "other"} [role]
 * @property {string} [joinPhrase]
 * @property {string} [sourceUrl]
 *
 * @typedef {Object} DatePrecision
 * @property {string} value
 * @property {"year" | "month" | "day"} precision
 *
 * @typedef {Object} LabelCredit
 * @property {string} name
 * @property {string} [catalogNumber]
 * @property {string} [sourceUrl]
 *
 * @typedef {Object} CompanyCredit
 * @property {string} name
 * @property {string} [role]
 * @property {string} [sourceUrl]
 *
 * @typedef {Object} FormatInfo
 * @property {"CD" | "Vinyl" | "Cassette" | "Digital" | "File" | "SACD" | "DVD" | "Other"} type
 * @property {number} [quantity]
 * @property {string[]} [descriptions]
 *
 * @typedef {Object} Identifier
 * @property {"Barcode" | "Matrix" | "Rights Society" | "Other"} type
 * @property {string} value
 * @property {string} [description]
 *
 * @typedef {Object} CatalogNumber
 * @property {string} [label]
 * @property {string} value
 *
 * @typedef {Object} Track
 * @property {string} [position]
 * @property {string} title
 * @property {string} [duration]
 * @property {ArtistCredit[]} [artists]
 * @property {Credit[]} [credits]
 * @property {Track[]} [subTracks]
 *
 * @typedef {Object} Credit
 * @property {string} name
 * @property {string} role
 * @property {"release" | "track"} [target]
 * @property {string} [trackPosition]
 *
 * @typedef {Object} ImageRef
 * @property {string} url
 * @property {"cover" | "back" | "media" | "other"} kind
 * @property {"api" | "user"} source
 *
 * @typedef {Object} ExternalUrl
 * @property {"discogs" | "official" | "other"} provider
 * @property {string} url
 *
 * @typedef {Object} ImportWarning
 * @property {string} [field]
 * @property {WarningLevel} level
 * @property {string} message
 *
 * @typedef {Object} AlbumReleaseMetadata
 * @property {"0.1"} schemaVersion
 * @property {SourceInfo} source
 * @property {Object} release
 * @property {string} release.title
 * @property {string} [release.displayTitle]
 * @property {ArtistCredit[]} release.artists
 * @property {DatePrecision} [release.releaseDate]
 * @property {string} [release.country]
 * @property {LabelCredit[]} release.labels
 * @property {CompanyCredit[]} [release.companies]
 * @property {FormatInfo[]} release.formats
 * @property {string[]} release.genres
 * @property {string[]} release.styles
 * @property {Identifier[]} release.identifiers
 * @property {CatalogNumber[]} release.catalogNumbers
 * @property {Track[]} release.tracklist
 * @property {Credit[]} release.credits
 * @property {string} [release.notes]
 * @property {ImageRef} [release.coverImage]
 * @property {ExternalUrl[]} release.externalUrls
 * @property {Record<string, ConfidenceLevel>} confidence
 * @property {Record<string, string[]>} provenance
 * @property {ImportWarning[]} warnings
 */
