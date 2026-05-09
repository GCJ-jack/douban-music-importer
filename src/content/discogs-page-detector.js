(() => {
  const state = parseDiscogsReleaseUrl(window.location.href);

  if (!state.supported) {
    return;
  }

  const root = document.createElement("div");
  root.id = "douban-music-importer-discogs-hint";
  root.textContent = `Douban Music Importer: Discogs release ${state.releaseId} 可导入`;
  root.setAttribute("role", "status");

  Object.assign(root.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    maxWidth: "320px",
    padding: "10px 12px",
    border: "1px solid #2f6f4e",
    borderRadius: "6px",
    background: "#f3fbf6",
    color: "#17452e",
    fontSize: "13px",
    lineHeight: "1.4",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
  });

  document.documentElement.append(root);

  function parseDiscogsReleaseUrl(input) {
    let url;

    try {
      url = new URL(input);
    } catch {
      return { supported: false, releaseId: null };
    }

    if (!["discogs.com", "www.discogs.com"].includes(url.hostname.toLowerCase())) {
      return { supported: false, releaseId: null };
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const releaseIndex = segments.findIndex((segment) => segment.toLowerCase() === "release");
    if (releaseIndex === -1 || releaseIndex === segments.length - 1) {
      return { supported: false, releaseId: null };
    }

    const match = segments[releaseIndex + 1].match(/^(\d+)(?:$|[-_])/);
    return match
      ? { supported: true, releaseId: match[1] }
      : { supported: false, releaseId: null };
  }
})();
