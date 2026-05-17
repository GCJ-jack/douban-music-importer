import { parseDiscogsReleaseUrl } from "../core/discogs-url-parser.js";
import {
  listReviewFields,
  summarizeDraftReviewState,
  summarizeReviewReadiness,
} from "../core/review/draft-review-state.js";

const elements = {
  status: document.querySelector("#status"),
  pageSupport: document.querySelector("#page-support"),
  releaseId: document.querySelector("#release-id"),
  apiStatus: document.querySelector("#api-status"),
  importButton: document.querySelector("#import-button"),
  rymImportButton: document.querySelector("#rym-import-button"),
  resultMessage: document.querySelector("#result-message"),
  draftReview: document.querySelector("#draft-review"),
  clearDraftButton: document.querySelector("#clear-draft-button"),
  draftFieldCount: document.querySelector("#draft-field-count"),
  draftConfirmedCount: document.querySelector("#draft-confirmed-count"),
  draftReviewCount: document.querySelector("#draft-review-count"),
  draftUnmappedCount: document.querySelector("#draft-unmapped-count"),
  draftSource: document.querySelector("#draft-source"),
  draftFields: document.querySelector("#draft-fields"),
  fillReadinessMessage: document.querySelector("#fill-readiness-message"),
  fillHandoffButton: document.querySelector("#fill-handoff-button"),
  fillPayloadSummary: document.querySelector("#fill-payload-summary"),
  draftWarnings: document.querySelector("#draft-warnings"),
  draftWarningList: document.querySelector("#draft-warning-list"),
  draftUnmapped: document.querySelector("#draft-unmapped"),
  draftUnmappedList: document.querySelector("#draft-unmapped-list"),
};

let currentUrl = "";
let currentPage = {
  supported: false,
  releaseId: null,
  reason: "unknown",
};
let currentRymPage = {
  supported: false,
  reason: "unknown",
};

init();

async function init() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  currentUrl = activeTab?.url || "";
  currentPage = parseDiscogsReleaseUrl(currentUrl);
  currentRymPage = parseRymAlbumUrl(currentUrl);

  renderPageState(currentPage, currentRymPage);

  elements.importButton.addEventListener("click", () => {
    importCurrentRelease().catch((error) => {
      renderImportError({
        code: "unexpected_error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });

  elements.rymImportButton.addEventListener("click", () => {
    importCurrentRymPage().catch((error) => {
      renderImportError({
        code: "unexpected_error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });

  elements.draftFields.addEventListener("click", (event) => {
    handleDraftFieldClick(event).catch((error) => {
      elements.resultMessage.textContent = error instanceof Error ? error.message : String(error);
    });
  });

  elements.draftFields.addEventListener("change", (event) => {
    handleDraftFieldChange(event).catch((error) => {
      elements.resultMessage.textContent = error instanceof Error ? error.message : String(error);
    });
  });

  elements.clearDraftButton.addEventListener("click", () => {
    clearDraft().catch((error) => {
      elements.resultMessage.textContent = error instanceof Error ? error.message : String(error);
    });
  });

  elements.fillHandoffButton.addEventListener("click", () => {
    requestDoubanFillHandoff().catch((error) => {
      elements.resultMessage.textContent = error instanceof Error ? error.message : String(error);
    });
  });

  await loadDraftReviewState();
}

function renderPageState(page, rymPage) {
  const unsupportedReason = rymPage.reason !== "unsupported_host" ? rymPage.reason : page.reason;
  elements.status.textContent = page.supported
    ? "当前 Discogs release 页面支持导入。"
    : rymPage.supported
      ? "当前 RYM album 页面支持读取可见信息。"
      : "当前页面不是支持的 Discogs release 或 RYM album 页面。";
  elements.pageSupport.textContent = page.supported
    ? "Discogs release"
    : rymPage.supported
      ? "RYM album"
      : reasonText(unsupportedReason);
  elements.releaseId.textContent = page.releaseId || "-";
  elements.importButton.disabled = !page.supported;
  elements.rymImportButton.disabled = !rymPage.supported;
}

async function importCurrentRelease() {
  elements.importButton.disabled = true;
  elements.apiStatus.textContent = "请求中";
  elements.resultMessage.textContent = "正在请求当前 release 的 Discogs 官方 API…";

  const response = await chrome.runtime.sendMessage({
    type: "IMPORT_DISCOGS_RELEASE",
    url: currentUrl,
  });

  if (!response?.ok) {
    renderImportError(response?.error || {
      code: "unknown_error",
      message: "导入失败。",
    });
    elements.importButton.disabled = !currentPage.supported;
    return;
  }

  const summary = response.metadataSummary;
  elements.apiStatus.textContent = "已保存 raw source metadata";
  elements.resultMessage.textContent = [
    `Release ${summary.releaseId} 获取成功。`,
    summary.title ? `标题：${summary.title}。` : "",
    `已生成豆瓣草稿摘要：${summary.draftFieldCount} 个字段，${summary.draftNeedsReviewCount} 个需复核，${summary.draftUnmappedCount} 个未映射，${summary.warningCount} 个 warning。`,
    summary.normalizedValid && summary.draftValid ? "Schema 校验通过。" : "Schema 校验未通过，请检查导入数据。",
  ].filter(Boolean).join(" ");
  await loadDraftReviewState();
  elements.importButton.disabled = false;
}

async function importCurrentRymPage() {
  elements.rymImportButton.disabled = true;
  elements.apiStatus.textContent = "读取中";
  elements.resultMessage.textContent = "正在读取当前 RYM 页面可见信息，不会请求 RYM URL。";

  const response = await chrome.runtime.sendMessage({
    type: "IMPORT_RYM_CURRENT_PAGE",
  });

  if (!response?.ok) {
    renderImportError(response?.error || {
      code: "unknown_error",
      message: "RYM 页面读取失败。",
    });
    elements.rymImportButton.disabled = !currentRymPage.supported;
    return;
  }

  const summary = response.metadataSummary;
  elements.apiStatus.textContent = "已保存 RYM current-page metadata";
  elements.resultMessage.textContent = [
    "RYM 页面读取成功。",
    summary.title ? `标题：${summary.title}。` : "",
    summary.artist ? `艺人：${summary.artist}。` : "",
    `已生成豆瓣草稿摘要：${summary.draftFieldCount} 个字段，${summary.draftNeedsReviewCount} 个需复核，${summary.draftUnmappedCount} 个未映射，${summary.warningCount} 个 warning。`,
    summary.normalizedValid && summary.draftValid ? "Schema 校验通过。" : "Schema 校验未通过，请检查导入数据。",
  ].filter(Boolean).join(" ");
  await loadDraftReviewState();
  elements.rymImportButton.disabled = false;
}

async function loadDraftReviewState() {
  const response = await chrome.runtime.sendMessage({
    type: "GET_DRAFT_REVIEW_STATE",
  });

  if (!response?.ok || !response.reviewState) {
    renderDraftReviewState(null);
    return;
  }

  renderDraftReviewState(response.reviewState);
}

function renderDraftReviewState(reviewState) {
  if (!reviewState) {
    elements.draftReview.hidden = true;
    elements.draftFields.replaceChildren();
    elements.draftWarningList.replaceChildren();
    elements.draftUnmappedList.replaceChildren();
    elements.fillReadinessMessage.textContent = "";
    elements.fillHandoffButton.disabled = true;
    elements.fillPayloadSummary.hidden = true;
    elements.fillPayloadSummary.textContent = "";
    return;
  }

  const summary = summarizeDraftReviewState(reviewState);
  elements.draftReview.hidden = false;
  elements.draftFieldCount.textContent = String(summary.fieldCount);
  elements.draftConfirmedCount.textContent = String(summary.confirmedCount);
  elements.draftReviewCount.textContent = String(summary.needsReviewCount);
  elements.draftUnmappedCount.textContent = String(summary.unmappedCount);
  elements.draftSource.textContent = reviewState.draft.sourceUrl
    ? `来源：${reviewState.draft.sourceUrl}`
    : reviewState.draft.attribution;

  elements.draftFields.replaceChildren(...listReviewFields(reviewState).map(renderDraftField));
  renderFillReadiness(reviewState);
  renderWarnings(reviewState.warnings || []);
  renderUnmapped(reviewState.draft.unmapped || []);
}

function renderFillReadiness(reviewState) {
  const readiness = summarizeReviewReadiness(reviewState);
  elements.fillHandoffButton.disabled = !readiness.ready;
  elements.fillPayloadSummary.hidden = true;
  elements.fillPayloadSummary.textContent = "";

  if (readiness.fillableFieldCount === 0) {
    elements.fillReadinessMessage.textContent = "没有可交给豆瓣填表的字段。";
    return;
  }

  if (!readiness.ready) {
    elements.fillReadinessMessage.textContent = [
      `可填写字段 ${readiness.fillableFieldCount} 个。`,
      `还有 ${readiness.unconfirmedFillableFieldCount} 个可填写字段未确认：${readiness.unconfirmedFillableFields.map(fieldLabel).join("、")}。`,
    ].join(" ");
    return;
  }

  elements.fillReadinessMessage.textContent = [
    `可填写字段 ${readiness.fillableFieldCount} 个，均已确认。`,
    "点击后只会尝试填写当前已打开的豆瓣详细表单，不会打开页面或提交。",
  ].join(" ");
}

function renderDraftField(item) {
  const article = document.createElement("article");
  article.className = [
    "draft-field",
    item.field.needsReview ? "needs-review" : "",
    item.review.confirmed ? "confirmed" : "",
  ].filter(Boolean).join(" ");
  article.dataset.fieldName = item.name;

  const header = document.createElement("div");
  header.className = "field-header";

  const title = document.createElement("h3");
  title.textContent = fieldLabel(item.name);

  const badges = document.createElement("div");
  badges.className = "field-badges";
  badges.append(createBadge(item.field.confidence));
  if (item.field.needsReview) {
    badges.append(createBadge("需复核", "review-badge"));
  }
  if (item.review.confirmed) {
    badges.append(createBadge("已确认", "confirmed-badge"));
  }

  header.append(title, badges);

  const value = document.createElement("textarea");
  value.className = "field-value";
  value.dataset.action = "edit";
  value.value = String(item.field.value ?? "");
  value.rows = textareaRows(value.value);
  value.setAttribute("aria-label", `${fieldLabel(item.name)} 值`);

  const meta = document.createElement("p");
  meta.className = "field-meta";
  meta.textContent = [
    item.field.sourceFields?.length ? `来源字段：${item.field.sourceFields.join(", ")}` : "",
    item.field.note || "",
  ].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "field-actions";

  if (item.name === "coverImageUrl") {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary-button compact-button";
    copyButton.dataset.action = "copy-cover-url";
    copyButton.textContent = "复制 URL";
    actions.append(copyButton);
  }

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "secondary-button compact-button";
  confirmButton.dataset.action = "confirm";
  confirmButton.textContent = item.review.confirmed ? "已确认" : "确认字段";
  confirmButton.disabled = item.review.confirmed;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "danger-button compact-button";
  removeButton.dataset.action = "remove";
  removeButton.textContent = "删除";

  actions.append(confirmButton, removeButton);
  article.append(header, value, meta, actions);
  return article;
}

function renderWarnings(warnings) {
  elements.draftWarnings.hidden = warnings.length === 0;
  elements.draftWarningList.replaceChildren(...warnings.map((warning) => {
    const item = document.createElement("li");
    item.textContent = [warning.level, warning.field, warning.message].filter(Boolean).join(" · ");
    return item;
  }));
}

function renderUnmapped(unmapped) {
  elements.draftUnmapped.hidden = unmapped.length === 0;
  elements.draftUnmappedList.replaceChildren(...unmapped.map((field) => {
    const item = document.createElement("li");
    item.textContent = `${field.sourceField}: ${formatUnknownValue(field.value)} (${field.reason})`;
    return item;
  }));
}

async function handleDraftFieldClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const fieldName = button.closest(".draft-field")?.dataset.fieldName;
  if (!fieldName) {
    return;
  }

  if (button.dataset.action === "confirm") {
    await mutateDraftField("CONFIRM_DRAFT_FIELD", { fieldName });
  }

  if (button.dataset.action === "remove") {
    await mutateDraftField("REMOVE_DRAFT_FIELD", { fieldName });
  }

  if (button.dataset.action === "copy-cover-url") {
    const value = button.closest(".draft-field")?.querySelector("textarea")?.value || "";
    await navigator.clipboard.writeText(value);
    elements.resultMessage.textContent = "封面 URL 已复制。不会自动上传封面。";
  }
}

async function handleDraftFieldChange(event) {
  const input = event.target.closest("textarea[data-action='edit']");
  if (!input) {
    return;
  }

  const fieldName = input.closest(".draft-field")?.dataset.fieldName;
  if (!fieldName) {
    return;
  }

  await mutateDraftField("UPDATE_DRAFT_FIELD", {
    fieldName,
    value: input.value,
  });
}

async function mutateDraftField(type, payload) {
  const response = await chrome.runtime.sendMessage({
    type,
    ...payload,
  });

  if (!response?.ok) {
    throw new Error(response?.error?.message || "草稿更新失败。");
  }

  renderDraftReviewState(response.reviewState);
}

async function clearDraft() {
  const response = await chrome.runtime.sendMessage({
    type: "CLEAR_DRAFT_REVIEW_STATE",
  });

  if (!response?.ok) {
    throw new Error(response?.error?.message || "清除草稿失败。");
  }

  elements.resultMessage.textContent = "草稿预览已清除。";
  renderDraftReviewState(null);
}

async function requestDoubanFillHandoff() {
  const response = await chrome.runtime.sendMessage({
    type: "REQUEST_DOUBAN_FILL_FROM_REVIEW_STATE",
  });

  elements.fillPayloadSummary.hidden = false;
  elements.fillPayloadSummary.textContent = JSON.stringify({
    ok: Boolean(response?.ok),
    code: response?.code || null,
    message: response?.message || null,
    readiness: response?.readiness || null,
    payloadSummary: response?.payloadSummary || null,
    result: response?.result || null,
    page: response?.page || null,
  }, null, 2);
  elements.resultMessage.textContent = response?.ok
    ? "已向当前豆瓣详细表单写入可填写字段。请在豆瓣页面人工检查。"
    : fillHandoffStatusText(response?.code);
}

function renderImportError(error) {
  elements.apiStatus.textContent = errorText(error.code);
  elements.resultMessage.textContent = error.message || "Discogs API 请求失败。";
}

function reasonText(reason) {
  const labels = {
    invalid_url: "URL 无效",
    unsupported_host: "不是 Discogs",
    not_release_page: "不是 release 页面",
    missing_release_id: "未找到 release_id",
    not_rym_album_page: "不是 RYM album 页面",
    unknown: "未知",
  };

  return labels[reason] || reason || "不支持";
}

function errorText(code) {
  const labels = {
    not_found: "404 未找到",
    rate_limited: "429 限流",
    network_error: "网络失败",
    http_error: "HTTP 错误",
    invalid_json: "响应格式错误",
    empty_response: "空响应",
    unsupported_rym_page: "不是 RYM album 页面",
    rym_extractor_unavailable: "RYM 读取不可用",
    no_active_tab: "未找到当前活动标签页",
  };

  return labels[code] || "请求失败";
}

function parseRymAlbumUrl(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    return { supported: false, reason: "invalid_url" };
  }

  if (!["rateyourmusic.com", "www.rateyourmusic.com"].includes(url.hostname.toLowerCase())) {
    return { supported: false, reason: "unsupported_host" };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() !== "release" || segments[1]?.toLowerCase() !== "album" || segments.length < 4) {
    return { supported: false, reason: "not_rym_album_page" };
  }

  return { supported: true, reason: "rym_album_page" };
}

function fillHandoffStatusText(code) {
  const labels = {
    not_ready: "还有可填写字段未确认，请先确认后再填写。",
    lookupPage: "当前是豆瓣查询/消重页，请先按豆瓣页面流程进入详细表单。",
    unsupported: "请先打开豆瓣音乐新条目详细表单。",
    douban_content_script_unavailable: "请先打开豆瓣音乐新条目详细表单。",
    no_active_tab: "未找到当前活动标签页。",
    fill_error: "填写时遇到错误，请查看交接摘要。",
  };

  return labels[code] || "未完成填写，请查看交接摘要。";
}

function fieldLabel(name) {
  const labels = {
    title: "唱片名",
    originalTitle: "又名",
    artists: "表演者",
    releaseDate: "发行时间",
    publisher: "出版者",
    media: "介质",
    genre: "流派",
    barcode: "条形码",
    catalogNumber: "Catalog No.",
    tracks: "曲目",
    summary: "简介",
    externalLinks: "参考资料",
    coverImageUrl: "封面 URL",
  };

  return labels[name] || name;
}

function createBadge(text, className = "") {
  const badge = document.createElement("span");
  badge.className = ["badge", className].filter(Boolean).join(" ");
  badge.textContent = text;
  return badge;
}

function textareaRows(value) {
  return Math.min(6, Math.max(2, value.split("\n").length));
}

function formatUnknownValue(value) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}
