import { CONFIDENCE_LEVELS, RELEASE_METADATA_SCHEMA_VERSION, WARNING_LEVELS } from "../schema/release-metadata.js";
import { DOUBAN_DRAFT_SCHEMA_VERSION } from "../schema/douban-draft.js";

export function validateAlbumReleaseMetadata(metadata) {
  const errors = [];

  if (!isObject(metadata)) {
    return { ok: false, errors: ["metadata must be an object"] };
  }

  requireEqual(errors, metadata.schemaVersion, RELEASE_METADATA_SCHEMA_VERSION, "schemaVersion");
  requireString(errors, metadata.source?.provider, "source.provider");
  requireString(errors, metadata.source?.sourceType, "source.sourceType");
  requireString(errors, metadata.source?.url, "source.url");
  requireString(errors, metadata.source?.id, "source.id");
  requireString(errors, metadata.source?.apiUrl, "source.apiUrl");
  requireString(errors, metadata.source?.fetchedAt, "source.fetchedAt");
  requireString(errors, metadata.release?.title, "release.title");

  for (const field of ["artists", "labels", "formats", "genres", "styles", "identifiers", "catalogNumbers", "tracklist", "credits", "externalUrls"]) {
    requireArray(errors, metadata.release?.[field], `release.${field}`);
  }

  validateConfidence(errors, metadata.confidence);
  validateProvenance(errors, metadata.provenance);
  validateWarnings(errors, metadata.warnings);

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateDoubanMusicDraft(draft) {
  const errors = [];

  if (!isObject(draft)) {
    return { ok: false, errors: ["draft must be an object"] };
  }

  requireEqual(errors, draft.schemaVersion, DOUBAN_DRAFT_SCHEMA_VERSION, "schemaVersion");
  requireString(errors, draft.sourceUrl, "sourceUrl");
  requireString(errors, draft.attribution, "attribution");

  if (!isObject(draft.fields)) {
    errors.push("fields must be an object");
  } else {
    for (const [name, field] of Object.entries(draft.fields)) {
      validateDraftField(errors, field, `fields.${name}`);
    }
  }

  requireArray(errors, draft.unmapped, "unmapped");

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function summarizeDraft(draft) {
  const fields = Object.values(draft?.fields || {});
  return {
    fieldCount: fields.length,
    needsReviewCount: fields.filter((field) => field?.needsReview).length,
    unmappedCount: Array.isArray(draft?.unmapped) ? draft.unmapped.length : 0,
  };
}

function validateDraftField(errors, field, path) {
  if (!isObject(field)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (field.value === undefined || field.value === null) {
    errors.push(`${path}.value is required`);
  }

  requireArray(errors, field.sourceFields, `${path}.sourceFields`);

  if (!CONFIDENCE_LEVELS.includes(field.confidence)) {
    errors.push(`${path}.confidence must be one of ${CONFIDENCE_LEVELS.join(", ")}`);
  }

  if (typeof field.needsReview !== "boolean") {
    errors.push(`${path}.needsReview must be boolean`);
  }
}

function validateConfidence(errors, confidence) {
  if (!isObject(confidence)) {
    errors.push("confidence must be an object");
    return;
  }

  for (const [field, value] of Object.entries(confidence)) {
    if (!CONFIDENCE_LEVELS.includes(value)) {
      errors.push(`confidence.${field} must be one of ${CONFIDENCE_LEVELS.join(", ")}`);
    }
  }
}

function validateProvenance(errors, provenance) {
  if (!isObject(provenance)) {
    errors.push("provenance must be an object");
    return;
  }

  for (const [field, value] of Object.entries(provenance)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      errors.push(`provenance.${field} must be an array of strings`);
    }
  }
}

function validateWarnings(errors, warnings) {
  if (!Array.isArray(warnings)) {
    errors.push("warnings must be an array");
    return;
  }

  warnings.forEach((warning, index) => {
    if (!isObject(warning)) {
      errors.push(`warnings.${index} must be an object`);
      return;
    }

    if (!WARNING_LEVELS.includes(warning.level)) {
      errors.push(`warnings.${index}.level must be one of ${WARNING_LEVELS.join(", ")}`);
    }

    requireString(errors, warning.message, `warnings.${index}.message`);
  });
}

function requireEqual(errors, actual, expected, path) {
  if (actual !== expected) {
    errors.push(`${path} must be ${expected}`);
  }
}

function requireString(errors, value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireArray(errors, value, path) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
