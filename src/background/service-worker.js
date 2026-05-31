import { fetchDiscogsMaster, fetchDiscogsRelease, DiscogsApiError } from "../core/discogs-api-client.js";
import { extractAotyCurrentPage } from "../core/aoty/aoty-current-page-extractor.js";
import { buildAotyManualPasteImport } from "../core/aoty/aoty-manual-paste-import.js";
import { parseDiscogsReleaseUrl } from "../core/discogs-url-parser.js";
import { mapReleaseToDoubanDraft } from "../core/mappers/douban-draft-mapper.js";
import { normalizeAotyAlbumPaste } from "../core/normalizers/aoty-album-normalizer.js";
import { normalizeDiscogsRelease } from "../core/normalizers/discogs-release-normalizer.js";
import { normalizeRymAlbumExtract } from "../core/normalizers/rym-album-normalizer.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  summarizeReviewReadiness,
} from "../core/review/draft-review-state.js";
import { extractRymCurrentPage } from "../core/rym/rym-current-page-extractor.js";
import { summarizeDraft, validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../core/validation/schema-validation.js";
import {
  clearDraftReviewState,
  confirmDraftField,
  getDraftReviewState,
  removeDraftField,
  saveDraftReviewState,
  updateDraftField,
} from "../storage/draft-store.js";
import { getRawSourceMetadata, saveRawSourceMetadata } from "../storage/raw-source-store.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: serializeError(error),
      });
    });

  return true;
});

async function handleMessage(message) {
  if (message.type === "CHECK_DISCOGS_URL") {
    return {
      ok: true,
      page: parseDiscogsReleaseUrl(message.url || ""),
    };
  }

  if (message.type === "IMPORT_DISCOGS_RELEASE") {
    return importDiscogsRelease(message.url || "");
  }

  if (message.type === "IMPORT_RYM_CURRENT_PAGE") {
    return importRymCurrentPage();
  }

  if (message.type === "IMPORT_AOTY_CURRENT_PAGE") {
    return importAotyCurrentPage();
  }

  if (message.type === "IMPORT_AOTY_MANUAL_PASTE") {
    return importAotyManualPaste({
      sourceUrl: message.sourceUrl,
      text: message.text,
    });
  }

  if (message.type === "GET_RAW_SOURCE_METADATA") {
    return {
      ok: true,
      metadata: await getRawSourceMetadata(),
    };
  }

  if (message.type === "GET_DRAFT_REVIEW_STATE") {
    return {
      ok: true,
      reviewState: await getDraftReviewState(),
    };
  }

  if (message.type === "UPDATE_DRAFT_FIELD") {
    return {
      ok: true,
      reviewState: await updateDraftField(message.fieldName, String(message.value ?? "")),
    };
  }

  if (message.type === "CONFIRM_DRAFT_FIELD") {
    return {
      ok: true,
      reviewState: await confirmDraftField(message.fieldName),
    };
  }

  if (message.type === "REMOVE_DRAFT_FIELD") {
    return {
      ok: true,
      reviewState: await removeDraftField(message.fieldName),
    };
  }

  if (message.type === "CLEAR_DRAFT_REVIEW_STATE") {
    await clearDraftReviewState();
    return {
      ok: true,
      reviewState: null,
    };
  }

  if (message.type === "REQUEST_DOUBAN_FILL_FROM_REVIEW_STATE") {
    const reviewState = await getDraftReviewState();
    const readiness = summarizeReviewReadiness(reviewState);
    const fillPayload = getFillableDraftFields(reviewState);

    if (!readiness.ready) {
      return {
        ok: false,
        code: "not_ready",
        message: "Confirm all fillable draft fields before filling the Douban form.",
        readiness,
        payloadSummary: summarizeFillPayload(fillPayload),
      };
    }

    const fillResponse = await sendDoubanFillRequest(fillPayload);
    return {
      ...fillResponse,
      readiness,
      payloadSummary: summarizeFillPayload(fillPayload),
    };
  }

  return {
    ok: false,
    error: {
      code: "unknown_message",
      message: `Unsupported message type: ${message.type}`,
    },
  };
}

async function importAotyManualPaste(input) {
  const result = buildAotyManualPasteImport(input);

  if (!result.ok) {
    return result;
  }

  await saveRawSourceMetadata(result.sourceMetadata);
  await saveDraftReviewState(result.reviewState);

  return {
    ok: true,
    metadataSummary: result.metadataSummary,
  };
}

async function importAotyCurrentPage() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    return {
      ok: false,
      error: {
        code: "no_active_tab",
        message: "No active tab is available for AOTY extraction.",
      },
    };
  }

  let injection;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: extractAotyCurrentPage,
    });
    injection = result?.result;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "aoty_extractor_unavailable",
        message: "Unable to read the current AOTY page. Open a supported AOTY album page and try again.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (!injection?.ok) {
    return {
      ok: false,
      page: injection?.page || null,
      error: {
        code: injection?.code || "unsupported_aoty_page",
        message: injection?.message || "Current page is not a supported AOTY album page.",
      },
      warnings: injection?.warnings || [],
    };
  }

  const sourceMetadata = {
    provider: "aoty",
    sourceType: "album",
    sourceMode: "currentPage",
    pageUrl: injection.extract.sourceUrl,
    extractorVersion: "0.3.0-prototype",
    fetchedAt: new Date().toISOString(),
    warnings: injection.warnings || [],
    raw: injection.extract,
  };

  await saveRawSourceMetadata(sourceMetadata);

  const normalizedMetadata = normalizeAotyAlbumPaste(sourceMetadata);
  const draft = mapReleaseToDoubanDraft(normalizedMetadata);
  const metadataValidation = validateAlbumReleaseMetadata(normalizedMetadata);
  const draftValidation = validateDoubanMusicDraft(draft);
  const draftSummary = summarizeDraft(draft);
  const reviewState = createDraftReviewState({
    draft,
    sourceSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      sourceMode: "currentPage",
      pageUrl: sourceMetadata.pageUrl,
      fetchedAt: sourceMetadata.fetchedAt,
      title: sourceMetadata.raw.title || null,
    },
    warnings: normalizedMetadata.warnings,
    validation: {
      metadata: metadataValidation,
      draft: draftValidation,
    },
  });
  await saveDraftReviewState(reviewState);

  return {
    ok: true,
    page: injection.page,
    metadataSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      sourceMode: "currentPage",
      pageUrl: sourceMetadata.pageUrl,
      fetchedAt: sourceMetadata.fetchedAt,
      title: sourceMetadata.raw.title || null,
      artist: sourceMetadata.raw.artist || null,
      normalizedValid: metadataValidation.ok,
      draftValid: draftValidation.ok,
      draftFieldCount: draftSummary.fieldCount,
      draftNeedsReviewCount: draftSummary.needsReviewCount,
      draftUnmappedCount: draftSummary.unmappedCount,
      warningCount: normalizedMetadata.warnings.length,
    },
  };
}

async function importDiscogsRelease(url) {
  const page = parseDiscogsReleaseUrl(url);

  if (!page.supported) {
    return {
      ok: false,
      page,
      error: {
        code: page.reason,
        message: "Current page is not a supported Discogs release or master page.",
      },
    };
  }

  const metadata = page.sourceType === "master"
    ? await fetchDiscogsMaster(page.masterId)
    : await fetchDiscogsRelease(page.releaseId);
  const sourceMetadata = {
    ...metadata,
    pageUrl: url,
    extractorVersion: "0.1.0",
  };

  await saveRawSourceMetadata(sourceMetadata);

  const normalizedMetadata = normalizeDiscogsRelease(sourceMetadata);
  const draft = mapReleaseToDoubanDraft(normalizedMetadata);
  const metadataValidation = validateAlbumReleaseMetadata(normalizedMetadata);
  const draftValidation = validateDoubanMusicDraft(draft);
  const draftSummary = summarizeDraft(draft);
  const reviewState = createDraftReviewState({
    draft,
    sourceSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      releaseId: sourceMetadata.releaseId,
      masterId: sourceMetadata.masterId,
      apiUrl: sourceMetadata.apiUrl,
      fetchedAt: sourceMetadata.fetchedAt,
      title: typeof sourceMetadata.raw.title === "string" ? sourceMetadata.raw.title : null,
    },
    warnings: normalizedMetadata.warnings,
    validation: {
      metadata: metadataValidation,
      draft: draftValidation,
    },
  });
  await saveDraftReviewState(reviewState);

  return {
    ok: true,
    page,
    metadataSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      releaseId: sourceMetadata.releaseId,
      masterId: sourceMetadata.masterId,
      apiUrl: sourceMetadata.apiUrl,
      fetchedAt: sourceMetadata.fetchedAt,
      title: typeof sourceMetadata.raw.title === "string" ? sourceMetadata.raw.title : null,
      normalizedValid: metadataValidation.ok,
      draftValid: draftValidation.ok,
      draftFieldCount: draftSummary.fieldCount,
      draftNeedsReviewCount: draftSummary.needsReviewCount,
      draftUnmappedCount: draftSummary.unmappedCount,
      warningCount: normalizedMetadata.warnings.length,
    },
  };
}

async function importRymCurrentPage() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    return {
      ok: false,
      error: {
        code: "no_active_tab",
        message: "No active tab is available for RYM extraction.",
      },
    };
  }

  let injection;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: extractRymCurrentPage,
    });
    injection = result?.result;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "rym_extractor_unavailable",
        message: "Unable to read the current RYM page. Open a supported RYM release page and try again.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (!injection?.ok) {
    return {
      ok: false,
      page: injection?.page || null,
      error: {
        code: injection?.code || "unsupported_rym_page",
        message: injection?.message || "Current page is not a supported RYM release page.",
      },
      warnings: injection?.warnings || [],
    };
  }

  const sourceMetadata = {
    provider: "rym",
    sourceType: "album",
    pageUrl: injection.extract.sourceUrl,
    extractorVersion: "0.2.0-prototype",
    fetchedAt: new Date().toISOString(),
    warnings: injection.warnings || [],
    raw: injection.extract,
  };

  await saveRawSourceMetadata(sourceMetadata);

  const normalizedMetadata = normalizeRymAlbumExtract(sourceMetadata);
  const draft = mapReleaseToDoubanDraft(normalizedMetadata);
  const metadataValidation = validateAlbumReleaseMetadata(normalizedMetadata);
  const draftValidation = validateDoubanMusicDraft(draft);
  const draftSummary = summarizeDraft(draft);
  const reviewState = createDraftReviewState({
    draft,
    sourceSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      pageUrl: sourceMetadata.pageUrl,
      fetchedAt: sourceMetadata.fetchedAt,
      title: sourceMetadata.raw.title || null,
    },
    warnings: normalizedMetadata.warnings,
    validation: {
      metadata: metadataValidation,
      draft: draftValidation,
    },
  });
  await saveDraftReviewState(reviewState);

  return {
    ok: true,
    page: injection.page,
    metadataSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      pageUrl: sourceMetadata.pageUrl,
      fetchedAt: sourceMetadata.fetchedAt,
      title: sourceMetadata.raw.title || null,
      artist: sourceMetadata.raw.artist || null,
      normalizedValid: metadataValidation.ok,
      draftValid: draftValidation.ok,
      draftFieldCount: draftSummary.fieldCount,
      draftNeedsReviewCount: draftSummary.needsReviewCount,
      draftUnmappedCount: draftSummary.unmappedCount,
      warningCount: normalizedMetadata.warnings.length,
    },
  };
}

function summarizeFillPayload(fillPayload) {
  return {
    fieldCount: Object.keys(fillPayload).length,
    fields: Object.keys(fillPayload),
  };
}

async function sendDoubanFillRequest(fillPayload) {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    return {
      ok: false,
      code: "no_active_tab",
      message: "No active tab is available for Douban form filling.",
    };
  }

  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: "FILL_DOUBAN_DETAILED_FORM",
      fields: fillPayload,
    });
    return response || {
      ok: false,
      code: "empty_douban_response",
      message: "Douban form assistant did not return a fill result.",
    };
  } catch (error) {
    return {
      ok: false,
      code: "douban_content_script_unavailable",
      message: "Open the Douban Music new-subject detailed form before filling.",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

function serializeError(error) {
  if (error instanceof DiscogsApiError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  return {
    code: "unexpected_error",
    message: error instanceof Error ? error.message : String(error),
  };
}
