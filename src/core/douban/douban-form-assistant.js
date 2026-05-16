export const DOUBAN_PAGE_STATE = {
  UNSUPPORTED: "unsupported",
  LOOKUP_PAGE: "lookupPage",
  DETAILED_FORM: "detailedForm",
};

const SAFE_FIELD_TARGETS = {
  title: "#p_27",
  releaseDate: "#p_51",
  publisher: "#p_50",
  discCount: "#p_55",
  discNumber: "#p_55",
  isrc: "#p_54",
  tracks: 'textarea[name="p_52_other"]',
  summary: 'textarea[name="p_28_other"]',
  externalLinks: 'textarea[name="p_152_other"]',
  reference: 'textarea[name="p_152_other"]',
};

const UNSUPPORTED_FIELDS = new Set([
  "barcode",
  "genre",
  "media",
  "coverImageUrl",
  "catalogNumber",
  "unmapped",
]);

export function detectDoubanNewSubjectPage(documentRef = globalThis.document, locationRef = globalThis.location) {
  if (!documentRef) {
    return {
      state: DOUBAN_PAGE_STATE.UNSUPPORTED,
      reason: "missing_document",
    };
  }

  const url = safeUrl(locationRef?.href || String(locationRef || ""));
  if (!url || url.hostname !== "music.douban.com" || url.pathname !== "/new_subject") {
    return {
      state: DOUBAN_PAGE_STATE.UNSUPPORTED,
      reason: "unsupported_url",
    };
  }

  if (isDetailedForm(documentRef)) {
    return {
      state: DOUBAN_PAGE_STATE.DETAILED_FORM,
      reason: "detailed_form_fields_present",
    };
  }

  if (isLookupPage(documentRef)) {
    return {
      state: DOUBAN_PAGE_STATE.LOOKUP_PAGE,
      reason: "lookup_fields_present",
    };
  }

  return {
    state: DOUBAN_PAGE_STATE.UNSUPPORTED,
    reason: "unrecognized_new_subject_page",
  };
}

export function fillDoubanDetailedForm(fields, options = {}) {
  const documentRef = options.document || globalThis.document;
  const locationRef = options.location || globalThis.location;
  const page = detectDoubanNewSubjectPage(documentRef, locationRef);
  const result = createFillResult();

  if (page.state !== DOUBAN_PAGE_STATE.DETAILED_FORM) {
    return {
      ok: false,
      code: page.state,
      page,
      result,
    };
  }

  for (const [fieldName, draftField] of Object.entries(fields || {})) {
    if (UNSUPPORTED_FIELDS.has(fieldName) || !isSupportedFillField(fieldName)) {
      result.unsupportedField.push(fieldName);
      continue;
    }

    if (fieldName === "artists") {
      fillArtists(documentRef, draftField, result);
      continue;
    }

    fillSingleControl(documentRef, fieldName, draftField, result);
  }

  return {
    ok: result.errors.length === 0,
    code: result.errors.length === 0 ? "filled_with_possible_skips" : "fill_error",
    page,
    result,
  };
}

function isDetailedForm(documentRef) {
  return Boolean(
    documentRef.querySelector("#p_27") &&
    documentRef.querySelector("#p_51") &&
    documentRef.querySelector("#p_50") &&
    documentRef.querySelector('textarea[name="p_52_other"]') &&
    documentRef.querySelector('textarea[name="p_152_other"]') &&
    documentRef.querySelector('input[name="detail_subject_submit"]'),
  );
}

function isLookupPage(documentRef) {
  const text = documentRef.body?.textContent || "";
  return text.includes("添加新的唱片") &&
    text.includes("唱片名") &&
    text.includes("条形码") &&
    text.includes("添加无条形码的唱片");
}

function fillArtists(documentRef, draftField, result) {
  const controls = Array.from(documentRef.querySelectorAll('input[name="p_48"]'))
    .filter(isSafeVisibleTextInput);

  if (controls.length === 0) {
    result.missingSelector.push({
      field: "artists",
      selector: 'input[name="p_48"]',
    });
    return;
  }

  writeControl(controls[0], "artists", draftField, result);
}

function fillSingleControl(documentRef, fieldName, draftField, result) {
  const selector = SAFE_FIELD_TARGETS[fieldName];
  const control = documentRef.querySelector(selector);

  if (!control || !isSafeTextControl(control)) {
    result.missingSelector.push({
      field: fieldName,
      selector,
    });
    return;
  }

  writeControl(control, fieldName, draftField, result);
}

function writeControl(control, fieldName, draftField, result) {
  const value = String(draftField?.value ?? "");
  if (value === "") {
    result.skippedEmptyValue.push(fieldName);
    return;
  }

  if (String(control.value || "").trim() !== "") {
    result.skippedExistingValue.push(fieldName);
    return;
  }

  control.value = value;
  dispatchInputEvents(control);
  result.filled.push(fieldName);
}

function dispatchInputEvents(control) {
  const EventConstructor = control.ownerDocument?.defaultView?.Event || globalThis.Event;
  if (!EventConstructor || typeof control.dispatchEvent !== "function") {
    return;
  }

  control.dispatchEvent(new EventConstructor("input", { bubbles: true }));
  control.dispatchEvent(new EventConstructor("change", { bubbles: true }));
}

function isSupportedFillField(fieldName) {
  return fieldName === "artists" || Object.hasOwn(SAFE_FIELD_TARGETS, fieldName);
}

function isSafeTextControl(control) {
  const tagName = control.tagName?.toLowerCase();
  if (tagName === "textarea") {
    return !control.disabled;
  }

  return isSafeVisibleTextInput(control);
}

function isSafeVisibleTextInput(control) {
  const tagName = control.tagName?.toLowerCase();
  const type = String(control.getAttribute?.("type") || control.type || "text").toLowerCase();
  return tagName === "input" &&
    type !== "hidden" &&
    !control.hidden &&
    !control.disabled;
}

function createFillResult() {
  return {
    filled: [],
    skippedExistingValue: [],
    skippedEmptyValue: [],
    missingSelector: [],
    unsupportedField: [],
    errors: [],
  };
}

function safeUrl(input) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}
