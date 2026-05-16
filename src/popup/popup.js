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

init();

async function init() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  currentUrl = activeTab?.url || "";
  currentPage = parseDiscogsReleaseUrl(currentUrl);

  renderPageState(currentPage);

  elements.importButton.addEventListener("click", () => {
    importCurrentRelease().catch((error) => {
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

function renderPageState(page) {
  elements.status.textContent = page.supported
    ? "当前 Discogs release 页面支持导入。"
    : "当前页面不是 v0.1 支持的 Discogs release 页面。";
  elements.pageSupport.textContent = page.supported ? "支持" : reasonText(page.reason);
  elements.releaseId.textContent = page.releaseId || "-";
  elements.importButton.disabled = !page.supported;
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
    "当前只生成交接摘要，不会打开、填写或提交豆瓣页面。",
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
    message: response?.message || "Douban form filling is not implemented yet.",
    readiness: response?.readiness || null,
    payloadSummary: response?.payloadSummary || null,
  }, null, 2);
  elements.resultMessage.textContent = "已生成填写交接摘要。当前版本不会操作豆瓣页面。";
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
  };

  return labels[code] || "请求失败";
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
