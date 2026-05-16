import { fetchDiscogsRelease, DiscogsApiError } from "../core/discogs-api-client.js";
import { parseDiscogsReleaseUrl } from "../core/discogs-url-parser.js";
import { mapReleaseToDoubanDraft } from "../core/mappers/douban-draft-mapper.js";
import { normalizeDiscogsRelease } from "../core/normalizers/discogs-release-normalizer.js";
import {
  createDraftReviewState,
  getFillableDraftFields,
  summarizeReviewReadiness,
} from "../core/review/draft-review-state.js";
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
    return {
      ok: false,
      code: "not_implemented",
      message: "Douban form filling is not implemented yet.",
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

async function importDiscogsRelease(url) {
  const page = parseDiscogsReleaseUrl(url);

  if (!page.supported) {
    return {
      ok: false,
      page,
      error: {
        code: page.reason,
        message: "Current page is not a supported Discogs release page.",
      },
    };
  }

  const metadata = await fetchDiscogsRelease(page.releaseId);
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

function summarizeFillPayload(fillPayload) {
  return {
    fieldCount: Object.keys(fillPayload).length,
    fields: Object.keys(fillPayload),
  };
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
