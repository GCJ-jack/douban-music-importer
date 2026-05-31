export function extractAotyCurrentPage(options = {}) {
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

  function attr(selector, attribute, root = documentRef) {
    return text(root?.querySelector?.(selector)?.getAttribute?.(attribute));
  }

  function parseUrl(input) {
    try {
      return new URL(input);
    } catch {
      return null;
    }
  }

  function parseAotyAlbumPage(url) {
    if (!url) return { supported: false, reason: "invalid_url", id: "" };
    const host = url.hostname.toLowerCase();
    if (!["albumoftheyear.org", "www.albumoftheyear.org"].includes(host)) {
      return { supported: false, reason: "unsupported_host", id: "" };
    }

    const match = url.pathname.match(/\/album\/(\d+)-/i);
    return match
      ? { supported: true, reason: "aoty_album_page", id: match[1] }
      : { supported: false, reason: "not_aoty_album_page", id: "" };
  }

  function firstNonEmpty(...values) {
    return values.map(text).find(Boolean) || "";
  }

  function extractMusicAlbumJsonLd() {
    for (const script of all("script[type='application/ld+json'], script[type=\"application/ld+json\"]")) {
      const parsed = parseJsonLd(script.textContent);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const flattened = candidates.flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
      const album = flattened.find((item) => {
        const types = normalizeArray(item?.["@type"]).map((value) => String(value).toLowerCase());
        return types.includes("musicalbum") || types.includes("musicrelease");
      });
      if (album) return album;
    }
    return null;
  }

  function parseJsonLd(value) {
    try {
      return JSON.parse(String(value || "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&"));
    } catch {
      return null;
    }
  }

  function jsonLdArtist(jsonLd) {
    const artist = jsonLd?.byArtist || jsonLd?.artist;
    if (Array.isArray(artist)) {
      return text(artist.map((item) => text(item?.name || item)).filter(Boolean).join(" / "));
    }
    return text(artist?.name || artist);
  }

  function canonicalUrl(jsonLd) {
    return firstNonEmpty(
      jsonLd?.url,
      jsonLd?.["@id"],
      attr("link[rel='canonical'], link[rel=\"canonical\"]", "href"),
      attr("meta[property='og:url'], meta[property=\"og:url\"]", "content"),
      locationRef?.href,
    );
  }

  function headlineTitle() {
    return stripTitleSuffix(firstNonEmpty(
      textContent(".albumHeadline h1.albumTitle"),
      textContent("h1.albumTitle"),
      attr("meta[property='og:title'], meta[property=\"og:title\"]", "content"),
    ));
  }

  function headlineArtist() {
    return firstNonEmpty(
      textContent(".albumHeadline .artist"),
      textContent(".albumHeadline a[href*='/artist/']"),
      textContent("a[href*='/artist/']"),
    );
  }

  function detailRows() {
    return [
      ...all(".albumDetails tr"),
      ...all(".details tr"),
      ...all("[class*='detail'] tr"),
      ...all(".albumDetails div"),
      ...all(".details div"),
      ...all("[class*='detail'] div"),
      documentRef?.body,
    ].filter(Boolean);
  }

  function extractDetailValues(labels) {
    return unique(extractDetailRawValues(labels).flatMap(splitDelimited).filter(notPlaceholder));
  }

  function extractDetailRawValues(labels) {
    const values = [];
    const labelPattern = labels.map(escapeRegExp).join("|");
    const labelMatcher = new RegExp(`^(${labelPattern})\\s*[:：]?\\s*$`, "i");
    const inlineMatcher = new RegExp(`^(${labelPattern})\\s*[:：]\\s*(.+)$`, "i");
    const trailingLabelMatcher = new RegExp(`^(.+?)\\s*/\\s*(${labelPattern})\\s*$`, "i");
    const rows = detailRows();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rawRowText = String(row.textContent || "");
      const rowText = text(rawRowText);
      const inline = rowText.match(inlineMatcher);
      if (inline?.[2]) {
        values.push(inline[2]);
        continue;
      }
      const slashLabelValues = extractSlashLabelValues(rawRowText, labels);
      if (slashLabelValues.length) {
        values.push(...slashLabelValues);
        continue;
      }
      const trailingLabel = rowText.match(trailingLabelMatcher);
      if (trailingLabel?.[1]) {
        values.push(trailingLabel[1]);
        continue;
      }

      const cells = Array.from(row.querySelectorAll?.("th, td, .label, .value, span, a") || [])
        .map((cell) => text(cell.textContent))
        .filter(Boolean);
      for (let cellIndex = 0; cellIndex < cells.length - 1; cellIndex += 1) {
        if (labelMatcher.test(cells[cellIndex])) {
          values.push(cells.slice(cellIndex + 1).join(", "));
        }
        if (labelMatcher.test(cells[cellIndex + 1])) {
          values.push(cells[cellIndex]);
        }
      }

      if (labelMatcher.test(rowText)) {
        const nextText = text(rows[index + 1]?.textContent);
        if (nextText && !isDetailLabel(nextText) && !isNoiseLine(nextText)) {
          values.push(nextText);
        }
      }
    }

    return values.map(text).filter(Boolean);
  }

  function extractReleaseDate() {
    return firstNonEmpty(
      normalizeDate(textContent("[itemprop='datePublished']")),
      normalizeDate(extractDetailRawValues(["Release Date", "Released", "发布日期"])[0]),
    );
  }

  function extractTracks() {
    const rows = [
      ...all("#tracklist .trackListTable tr"),
      ...all("#tracklist tr"),
      ...all(".trackListTable tr"),
    ];
    const tracks = [];

    for (const row of rows) {
      const rowText = text(row.textContent);
      if (!rowText) continue;
      const position = textContent(".trackNumber", row).replace(/[.)]$/, "");
      const title = cleanTrackTitle(firstNonEmpty(
        textContent(".trackTitle > a", row),
        textContent(".trackTitle a", row),
        textContent(".trackTitle", row),
      ));
      if (position && title) {
        tracks.push(`${position} ${title}`);
      }
    }

    return unique(tracks);
  }

  function hasCoverVisibility() {
    return Boolean(
      documentRef?.querySelector?.(".albumArt, .albumCover, [class*='cover'], img[alt*='cover'], meta[property='og:image']"),
    );
  }

  const url = parseUrl(locationRef?.href || "");
  const page = parseAotyAlbumPage(url);
  if (!page.supported) {
    return {
      ok: false,
      code: "unsupported_aoty_page",
      message: "Current page is not a supported AOTY album page.",
      page: {
        supported: false,
        reason: page.reason,
        url: locationRef?.href || "",
      },
      warnings,
      extract: null,
    };
  }

  const jsonLd = extractMusicAlbumJsonLd();
  const sourceUrl = canonicalUrl(jsonLd);
  const title = firstNonEmpty(jsonLd?.name, headlineTitle());
  const artist = firstNonEmpty(jsonLdArtist(jsonLd), headlineArtist());
  const releaseDate = firstNonEmpty(normalizeDate(jsonLd?.datePublished), extractReleaseDate());
  const tracks = extractTracks();
  const genres = unique([
    ...normalizeArray(jsonLd?.genre).flatMap(splitDelimited),
    ...extractDetailValues(["Genre", "Genres", "Primary Genres", "Secondary Genres", "Tags", "类型"]),
  ].filter(notPlaceholder));
  const labels = extractDetailValues(["Label", "Labels", "厂牌"]);
  const formats = extractDetailValues(["Format", "Formats", "格式"]);

  if (!title || !artist || (!releaseDate && tracks.length === 0 && !jsonLd)) {
    return {
      ok: false,
      code: "unsupported_aoty_dom",
      message: "Current page DOM is not a supported AOTY album page.",
      page: {
        supported: false,
        reason: "unsupported_dom",
        url: url.href,
      },
      warnings,
      extract: null,
    };
  }

  if (!tracks.length) {
    warnings.push(warning("release.tracklist", "AOTY current page did not include a tracklist."));
  }

  return {
    ok: true,
    page: {
      supported: true,
      reason: "aoty_album_page",
      url: sourceUrl || url.href,
      sourceId: page.id,
    },
    warnings,
    extract: {
      ok: true,
      provider: "aoty",
      sourceType: "album",
      sourceMode: "currentPage",
      sourceUrl: sourceUrl || url.href,
      sourceId: page.id,
      title,
      artist,
      releaseDate,
      tracks,
      genres,
      tags: [],
      labels,
      formats,
      coverVisible: hasCoverVisibility(),
      warnings,
    },
  };

  function normalizeDate(value) {
    const raw = text(value);
    if (!raw) return "";
    const iso = raw.match(/\b(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?\b/);
    if (iso) {
      const month = iso[2].padStart(2, "0");
      const day = iso[3] ? iso[3].padStart(2, "0") : "";
      return day ? `${iso[1]}-${month}-${day}` : `${iso[1]}-${month}`;
    }

    const monthNames = {
      jan: "01", january: "01",
      feb: "02", february: "02",
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", sept: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12",
    };
    const monthDayYear = raw.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (monthDayYear) {
      const month = monthNames[monthDayYear[1].toLowerCase()];
      if (month) return `${monthDayYear[3]}-${month}-${monthDayYear[2].padStart(2, "0")}`;
    }
    const chineseDate = raw.match(/\b(19\d{2}|20\d{2})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日?)?/);
    if (chineseDate) {
      const month = chineseDate[2].padStart(2, "0");
      const day = chineseDate[3] ? chineseDate[3].padStart(2, "0") : "";
      return day ? `${chineseDate[1]}-${month}-${day}` : `${chineseDate[1]}-${month}`;
    }

    const year = raw.match(/\b(19\d{2}|20\d{2})\b/);
    return year ? year[1] : "";
  }

  function cleanTrackTitle(value) {
    return text(value)
      .replace(/\bfeat(?:\.|uring)?\b.*$/i, "")
      .replace(/\b\d+:\d{2}\b/g, "")
      .replace(/\b(?:producer|writer)s?\b.*$/i, "")
      .trim();
  }

  function isDetailLabel(value) {
    return /^(?:release date|released|genre|genres|primary genres|secondary genres|tags|label|labels|format|formats|发布日期|类型|厂牌|格式|制片人|作家)$/i.test(text(value));
  }

  function extractSlashLabelValues(rowText, targetLabels) {
    const allDetailLabels = [
      "Release Date",
      "Released",
      "发布日期",
      "Genre",
      "Genres",
      "Primary Genres",
      "Secondary Genres",
      "Tags",
      "类型",
      "Label",
      "Labels",
      "厂牌",
      "Format",
      "Formats",
      "格式",
      "Producer",
      "Producers",
      "制片人",
      "Writer",
      "Writers",
      "作家",
    ];
    const detailLabelPattern = allDetailLabels.map(escapeRegExp).join("|");
    const targetPattern = targetLabels.map(escapeRegExp).join("|");
    const targetMatcher = new RegExp(`^(${targetPattern})$`, "i");
    const slashLabelMatcher = new RegExp(`\\s*/\\s*(${detailLabelPattern})(?=$|\\s|[,，;；/])`, "gi");
    const lineValues = String(rowText || "")
      .split(/\r?\n/)
      .map(text)
      .map((line) => {
        const labelCount = [...line.matchAll(new RegExp(`\\s*/\\s*(${detailLabelPattern})(?=$|\\s|[,，;；/])`, "gi"))].length;
        if (labelCount !== 1) return "";
        const match = line.match(new RegExp(`^(.+?)\\s*/\\s*(${targetPattern})\\s*$`, "i"));
        return match?.[1] && !isNoiseLine(match[1]) ? match[1] : "";
      })
      .filter(Boolean);
    if (lineValues.length) {
      return lineValues;
    }

    const matches = [...text(rowText).matchAll(slashLabelMatcher)];
    const values = [];

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const label = text(match[1]);
      if (!targetMatcher.test(label)) continue;

      const previousEnd = index === 0
        ? 0
        : (matches[index - 1].index || 0) + matches[index - 1][0].length;
      const rawValue = rowText.slice(previousEnd, match.index);
      const value = text(rawValue).replace(/^[,，;；|/]+/, "").replace(/[,，;；|/]+$/, "");
      if (value && !isNoiseLine(value)) {
        values.push(value);
      }
    }

    return values;
  }

  function isNoiseLine(value) {
    return /(?:critic score|user score|comments?|reviews?|rankings?|charts?|lists?|amazon|apple music|spotify|soundcloud|bandcamp|vinyl|purchasing|contributions by|sign in|submit correction|add critic rating|cloudflare|analytics|advertis)/i.test(text(value));
  }

  function stripTitleSuffix(value) {
    return text(value).replace(/\s+-\s+Album of the Year.*$/i, "");
  }

  function splitDelimited(value) {
    return text(value).split(/\s*(?:,|，|;|；|\||\/)\s*/).map(text).filter(Boolean);
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    return value === undefined || value === null || value === "" ? [] : [value];
  }

  function notPlaceholder(value) {
    const cleaned = text(value);
    return Boolean(cleaned) && cleaned !== "-" && !/^n\/a$/i.test(cleaned);
  }

  function unique(values) {
    return [...new Set(values.map(text).filter(Boolean))];
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function warning(field, message, level = "warning") {
    return { field, level, message };
  }
}
