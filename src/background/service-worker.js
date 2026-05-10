import { fetchDiscogsRelease, DiscogsApiError } from "../core/discogs-api-client.js";
import { parseDiscogsReleaseUrl } from "../core/discogs-url-parser.js";
import { mapReleaseToDoubanDraft } from "../core/mappers/douban-draft-mapper.js";
import { normalizeDiscogsRelease } from "../core/normalizers/discogs-release-normalizer.js";
import { summarizeDraft, validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../core/validation/schema-validation.js";
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
