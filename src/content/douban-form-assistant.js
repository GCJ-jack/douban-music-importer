(async () => {
  const {
    detectDoubanNewSubjectPage,
    fillDoubanDetailedForm,
  } = await import(chrome.runtime.getURL("src/core/douban/douban-form-assistant.js"));

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return false;
    }

    if (message.type === "DETECT_DOUBAN_NEW_SUBJECT_PAGE") {
      sendResponse({
        ok: true,
        page: detectDoubanNewSubjectPage(document, window.location),
      });
      return false;
    }

    if (message.type === "FILL_DOUBAN_DETAILED_FORM") {
      sendResponse(fillDoubanDetailedForm(message.fields || {}, {
        document,
        location: window.location,
      }));
      return false;
    }

    return false;
  });
})();
