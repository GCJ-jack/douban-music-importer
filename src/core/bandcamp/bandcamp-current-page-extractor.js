export function extractBandcampCurrentPage(options = {}) {
  const documentRef = options.document || globalThis.document;
  const locationRef = options.location || globalThis.location;
  const warnings = [];

  function text(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function textContent(selector, root = documentRef) {
    return text(root?.querySelector?.(selector)?.textContent);
  }

  function all(selector, root = documentRef) {
    return Array.from(root?.querySelectorAll?.(selector) || []);
  }

  function allText(selector, root = documentRef) {
    return all(selector, root).map((node) => text(node.textContent)).filter(Boolean);
  }

  function parseUrl(input) {
    try {
      return new URL(input);
    } catch {
      return null;
    }
  }

  function parseBandcampAlbumPage(url) {
    if (!url) return { supported: false, reason: "invalid_url" };
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (host !== "bandcamp.com" && !host.endsWith(".bandcamp.com"))) {
      return { supported: false, reason: "unsupported_host" };
    }

    return /^\/album\/[^/]+\/?$/i.test(url.pathname)
      ? { supported: true, reason: "bandcamp_album_page" }
      : { supported: false, reason: "not_bandcamp_album_page" };
  }

  function firstNonEmpty(...values) {
    return values.map(text).find(Boolean) || "";
  }

  function parseJsonLd(value) {
    try {
      return JSON.parse(String(value || ""));
    } catch {
      return null;
    }
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    return value === undefined || value === null || value === "" ? [] : [value];
  }

  function normalizeAlbumUrl(input) {
    const url = parseUrl(text(input));
    if (!parseBandcampAlbumPage(url).supported) return "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  }

  function jsonLdAlbumUrls(jsonLd) {
    const mainEntity = typeof jsonLd?.mainEntityOfPage === "object"
      ? jsonLd.mainEntityOfPage?.["@id"] || jsonLd.mainEntityOfPage?.url
      : jsonLd?.mainEntityOfPage;
    return [jsonLd?.["@id"], mainEntity].map(normalizeAlbumUrl).filter(Boolean);
  }

  function extractMusicAlbumJsonLd(currentAlbumUrl) {
    for (const script of all("script[type='application/ld+json']")) {
      const parsed = parseJsonLd(script.textContent);
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      const entities = roots.flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
      const album = entities.find((item) =>
        normalizeArray(item?.["@type"]).some((type) => String(type).toLowerCase() === "musicalbum") &&
        jsonLdAlbumUrls(item).includes(currentAlbumUrl)
      );
      if (album) return album;
    }
    return null;
  }

  function namedValue(value) {
    if (Array.isArray(value)) {
      return text(value.map((item) => text(item?.name || item)).filter(Boolean).join(" / "));
    }
    return text(value?.name || value);
  }

  function extractJsonLdTracks(jsonLd) {
    const elements = normalizeArray(jsonLd?.track?.itemListElement);
    return uniqueTracks(elements.map((entry) => {
      const position = text(entry?.position);
      const title = text(entry?.item?.name);
      return position && title ? `${position} ${title}` : "";
    }).filter(Boolean));
  }

  function extractDomTracks() {
    return uniqueTracks(all("#track_table tr.track_row_view").map((row) => {
      const position = textContent(".track_number", row).replace(/[.)]$/, "");
      const title = textContent(".track-title", row);
      return position && title ? `${position} ${title}` : "";
    }).filter(Boolean));
  }

  function extractDomReleaseDate() {
    const credits = textContent(".tralbum-credits");
    return normalizeDate(credits.match(/\breleased\s+(.+?)(?:\s{2,}|$)/i)?.[1] || credits);
  }

  function splitKeywords(value) {
    return normalizeArray(value)
      .flatMap((item) => text(item).split(/\s*(?:,|;|\|)\s*/))
      .map(text)
      .filter(Boolean);
  }

  function unique(values) {
    return [...new Set(values.map(text).filter(Boolean))];
  }

  function uniqueTracks(values) {
    const seen = new Set();
    return values.filter((value) => {
      const normalized = text(value);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeDate(value) {
    const raw = text(value);
    if (!raw) return "";

    const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const months = {
      jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
      apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
      aug: "08", august: "08", sep: "09", sept: "09", september: "09",
      oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
    };
    const named = raw.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (named && months[named[1].toLowerCase()]) {
      return `${named[3]}-${months[named[1].toLowerCase()]}-${named[2].padStart(2, "0")}`;
    }

    return raw.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || "";
  }

  const currentUrl = parseUrl(locationRef?.href || "");
  const page = parseBandcampAlbumPage(currentUrl);
  if (!page.supported) {
    return {
      ok: false,
      code: "unsupported_bandcamp_page",
      message: "Current page is not a supported Bandcamp album page.",
      page: { supported: false, reason: page.reason, url: locationRef?.href || "" },
      warnings,
      extract: null,
    };
  }

  const currentAlbumUrl = normalizeAlbumUrl(currentUrl?.href);
  const jsonLd = extractMusicAlbumJsonLd(currentAlbumUrl);
  const title = firstNonEmpty(jsonLd?.name, textContent("#name-section .trackTitle"));
  const artist = firstNonEmpty(namedValue(jsonLd?.byArtist), textContent("#name-section h3 a"));
  const releaseDate = firstNonEmpty(normalizeDate(jsonLd?.datePublished), extractDomReleaseDate());
  const jsonLdTracks = extractJsonLdTracks(jsonLd);
  const tracks = jsonLdTracks.length ? jsonLdTracks : extractDomTracks();
  const jsonLdTags = splitKeywords(jsonLd?.keywords);
  const tags = jsonLdTags.length ? unique(jsonLdTags) : unique(allText(".tralbum-tags a.tag"));
  const hostingPublishers = unique([namedValue(jsonLd?.publisher)]);
  const resolvedSourceUrl = currentAlbumUrl;

  if (!title || !artist || (!releaseDate && tracks.length === 0 && !jsonLd)) {
    return {
      ok: false,
      code: "unsupported_bandcamp_dom",
      message: "Current page DOM is not a supported Bandcamp album page.",
      page: { supported: false, reason: "unsupported_dom", url: currentUrl.href },
      warnings,
      extract: null,
    };
  }

  if (!tracks.length) {
    warnings.push(warning("release.tracklist", "Bandcamp current page did not include a tracklist."));
  }

  return {
    ok: true,
    page: {
      supported: true,
      reason: "bandcamp_album_page",
      url: resolvedSourceUrl,
    },
    warnings,
    extract: {
      ok: true,
      provider: "bandcamp",
      sourceType: "album",
      sourceMode: "currentPage",
      sourceUrl: resolvedSourceUrl,
      title,
      artist,
      releaseDate,
      tracks,
      tags,
      hostingPublishers,
      formats: [],
      coverVisible: false,
      warnings,
    },
  };

  function warning(field, message) {
    return { field, level: "warning", message };
  }
}
