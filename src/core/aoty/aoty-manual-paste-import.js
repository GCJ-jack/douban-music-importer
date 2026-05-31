import { mapReleaseToDoubanDraft } from "../mappers/douban-draft-mapper.js";
import { normalizeAotyAlbumPaste } from "../normalizers/aoty-album-normalizer.js";
import { createDraftReviewState } from "../review/draft-review-state.js";
import { summarizeDraft, validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../validation/schema-validation.js";
import { parseAotyManualPaste, parseAotySourceUrl } from "./aoty-manual-paste-parser.js";

export function buildAotyManualPasteImport(input = {}) {
  const sourceUrl = cleanString(input.sourceUrl);
  const text = String(input.text || "");

  if (!sourceUrl) {
    return invalidInput("请填写 AOTY album URL。");
  }

  if (!text.trim()) {
    return invalidInput("请粘贴 AOTY 页面可见文本或 HTML。");
  }

  const page = parseAotySourceUrl(sourceUrl);
  if (!page.supported) {
    return invalidInput("AOTY album URL 无效。", page);
  }

  try {
    const extract = parseAotyManualPaste({ text, sourceUrl });
    const sourceMetadata = {
      provider: "aoty",
      sourceType: "album",
      sourceMode: "manualPaste",
      pageUrl: extract.sourceUrl || sourceUrl,
      extractorVersion: input.extractorVersion || "0.1.0-prototype",
      fetchedAt: input.fetchedAt || new Date().toISOString(),
      warnings: extract.warnings || [],
      raw: extract,
    };
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
        sourceMode: "manualPaste",
        pageUrl: sourceMetadata.pageUrl,
        fetchedAt: sourceMetadata.fetchedAt,
        title: sourceMetadata.raw.title || null,
      },
      warnings: normalizedMetadata.warnings,
      validation: {
        metadata: metadataValidation,
        draft: draftValidation,
      },
      now: input.now,
    });

    return {
      ok: true,
      sourceMetadata,
      normalizedMetadata,
      draft,
      reviewState,
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
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "aoty_parse_failed",
        message: "AOTY 粘贴内容解析失败。",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function invalidInput(message, page = null) {
  return {
    ok: false,
    page,
    error: {
      code: "invalid_aoty_input",
      message,
    },
  };
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
