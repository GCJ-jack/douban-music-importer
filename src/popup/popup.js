import { parseDiscogsReleaseUrl } from "../core/discogs-url-parser.js";

const elements = {
  status: document.querySelector("#status"),
  pageSupport: document.querySelector("#page-support"),
  releaseId: document.querySelector("#release-id"),
  apiStatus: document.querySelector("#api-status"),
  importButton: document.querySelector("#import-button"),
  resultMessage: document.querySelector("#result-message"),
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
  elements.importButton.disabled = false;
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
