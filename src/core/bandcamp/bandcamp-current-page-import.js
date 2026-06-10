import { mapReleaseToDoubanDraft } from "../mappers/douban-draft-mapper.js";
import { normalizeBandcampAlbumExtract } from "../normalizers/bandcamp-album-normalizer.js";
import { createDraftReviewState } from "../review/draft-review-state.js";
import { summarizeDraft, validateAlbumReleaseMetadata, validateDoubanMusicDraft } from "../validation/schema-validation.js";

export function buildBandcampCurrentPageImport(injection, options = {}) {
  if (!injection?.ok) {
    return {
      ok: false,
      page: injection?.page || null,
      error: {
        code: injection?.code || "unsupported_bandcamp_page",
        message: injection?.message || "Current page is not a supported Bandcamp album page.",
      },
      warnings: injection?.warnings || [],
    };
  }

  const fetchedAt = options.fetchedAt || new Date().toISOString();
  const sourceMetadata = {
    provider: "bandcamp",
    sourceType: "album",
    sourceMode: "currentPage",
    pageUrl: injection.extract.sourceUrl,
    extractorVersion: "0.1.0-prototype",
    fetchedAt,
    warnings: injection.warnings || [],
    raw: injection.extract,
  };
  const normalizedMetadata = normalizeBandcampAlbumExtract(sourceMetadata);
  const draft = mapReleaseToDoubanDraft(normalizedMetadata);
  const metadataValidation = validateAlbumReleaseMetadata(normalizedMetadata);
  const draftValidation = validateDoubanMusicDraft(draft);
  const draftSummary = summarizeDraft(draft);
  const reviewState = createDraftReviewState({
    draft,
    sourceSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      sourceMode: sourceMetadata.sourceMode,
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

  return {
    ok: true,
    page: injection.page,
    sourceMetadata,
    reviewState,
    metadataSummary: {
      provider: sourceMetadata.provider,
      sourceType: sourceMetadata.sourceType,
      sourceMode: sourceMetadata.sourceMode,
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
