export const DRAFT_REVIEW_STATE_SCHEMA_VERSION = "0.1";
export const DOUBAN_FILLABLE_DRAFT_FIELDS = new Set([
  "title",
  "artists",
  "releaseDate",
  "publisher",
  "discCount",
  "discNumber",
  "isrc",
  "barcode",
  "tracks",
  "summary",
  "externalLinks",
  "reference",
]);

export function createDraftReviewState(options) {
  const now = options.now || new Date().toISOString();
  const draft = clone(options.draft);
  const fieldReview = {};

  for (const fieldName of Object.keys(draft.fields || {})) {
    fieldReview[fieldName] = {
      confirmed: false,
      removed: false,
    };
  }

  return {
    schemaVersion: DRAFT_REVIEW_STATE_SCHEMA_VERSION,
    status: "reviewing",
    draft,
    sourceSummary: clone(options.sourceSummary || {}),
    warnings: clone(options.warnings || []),
    validation: clone(options.validation || {}),
    fieldReview,
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeDraftReviewState(state) {
  const fields = Object.entries(state?.draft?.fields || {});
  const activeFields = fields.filter(([fieldName]) => !isRemoved(state, fieldName));

  return {
    fieldCount: activeFields.length,
    removedCount: fields.length - activeFields.length,
    confirmedCount: activeFields.filter(([fieldName]) => isConfirmed(state, fieldName)).length,
    needsReviewCount: activeFields.filter(([, field]) => field.needsReview).length,
    unmappedCount: Array.isArray(state?.draft?.unmapped) ? state.draft.unmapped.length : 0,
    warningCount: Array.isArray(state?.warnings) ? state.warnings.length : 0,
  };
}

export function listReviewFields(state) {
  return Object.entries(state?.draft?.fields || {})
    .filter(([fieldName]) => !isRemoved(state, fieldName))
    .map(([name, field]) => ({
      name,
      field,
      review: state.fieldReview?.[name] || { confirmed: false, removed: false },
    }));
}

export function summarizeReviewReadiness(state) {
  const fields = listReviewFields(state);
  const fillableFields = fields.filter((item) => isFillableDraftField(item.name));
  const confirmedFillableFields = fillableFields.filter((item) => item.review.confirmed);
  const unconfirmedFillableFields = fillableFields.filter((item) => !item.review.confirmed);

  return {
    ready: fillableFields.length > 0 && unconfirmedFillableFields.length === 0,
    fillableFieldCount: fillableFields.length,
    confirmedFillableFieldCount: confirmedFillableFields.length,
    unconfirmedFillableFieldCount: unconfirmedFillableFields.length,
    unconfirmedFillableFields: unconfirmedFillableFields.map((item) => item.name),
    unsupportedFieldCount: fields.length - fillableFields.length,
    unsupportedFields: fields
      .filter((item) => !isFillableDraftField(item.name))
      .map((item) => item.name),
  };
}

export function getFillableDraftFields(state) {
  return listReviewFields(state)
    .filter((item) => isFillableDraftField(item.name))
    .filter((item) => item.review.confirmed)
    .reduce((payload, item) => {
      payload[item.name] = clone(item.field);
      return payload;
    }, {});
}

export function applyDraftFieldEdit(state, fieldName, value, options = {}) {
  assertDraftFieldExists(state, fieldName);

  const next = clone(state);
  next.draft.fields[fieldName] = {
    ...next.draft.fields[fieldName],
    value,
  };
  next.fieldReview[fieldName] = {
    ...next.fieldReview[fieldName],
    confirmed: false,
    removed: false,
  };
  next.updatedAt = options.now || new Date().toISOString();
  return next;
}

export function markDraftFieldConfirmed(state, fieldName, options = {}) {
  assertDraftFieldExists(state, fieldName);

  const next = clone(state);
  next.fieldReview[fieldName] = {
    ...next.fieldReview[fieldName],
    confirmed: true,
    removed: false,
  };
  next.updatedAt = options.now || new Date().toISOString();
  return next;
}

export function markDraftFieldRemoved(state, fieldName, options = {}) {
  assertDraftFieldExists(state, fieldName);

  const next = clone(state);
  next.fieldReview[fieldName] = {
    ...next.fieldReview[fieldName],
    confirmed: false,
    removed: true,
  };
  next.updatedAt = options.now || new Date().toISOString();
  return next;
}

function assertDraftFieldExists(state, fieldName) {
  if (!state?.draft?.fields || !Object.hasOwn(state.draft.fields, fieldName)) {
    throw new Error(`Unknown draft field: ${fieldName}`);
  }
}

function isConfirmed(state, fieldName) {
  return Boolean(state?.fieldReview?.[fieldName]?.confirmed);
}

function isRemoved(state, fieldName) {
  return Boolean(state?.fieldReview?.[fieldName]?.removed);
}

function isFillableDraftField(fieldName) {
  return DOUBAN_FILLABLE_DRAFT_FIELDS.has(fieldName);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
