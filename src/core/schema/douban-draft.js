export const DOUBAN_DRAFT_SCHEMA_VERSION = "0.1";

export function createDraftField(value, options = {}) {
  return {
    value,
    sourceFields: options.sourceFields || [],
    confidence: options.confidence || "medium",
    needsReview: Boolean(options.needsReview),
    note: options.note,
  };
}

/**
 * @typedef {import("./release-metadata.js").ConfidenceLevel} ConfidenceLevel
 *
 * @typedef {Object} DraftField
 * @template T
 * @property {T} value
 * @property {string[]} sourceFields
 * @property {ConfidenceLevel} confidence
 * @property {boolean} needsReview
 * @property {string} [note]
 *
 * @typedef {Object} UnmappedField
 * @property {string} sourceField
 * @property {unknown} value
 * @property {string} reason
 *
 * @typedef {Object} DoubanMusicDraft
 * @property {"0.1"} schemaVersion
 * @property {string} sourceUrl
 * @property {string} attribution
 * @property {Object} fields
 * @property {DraftField<string>} [fields.title]
 * @property {DraftField<string>} [fields.originalTitle]
 * @property {DraftField<string>} [fields.artists]
 * @property {DraftField<string>} [fields.releaseDate]
 * @property {DraftField<string>} [fields.publisher]
 * @property {DraftField<string>} [fields.media]
 * @property {DraftField<string>} [fields.genre]
 * @property {DraftField<string>} [fields.barcode]
 * @property {DraftField<string>} [fields.catalogNumber]
 * @property {DraftField<string>} [fields.tracks]
 * @property {DraftField<string>} [fields.summary]
 * @property {DraftField<string>} [fields.externalLinks]
 * @property {DraftField<string>} [fields.coverImageUrl]
 * @property {UnmappedField[]} unmapped
 */
