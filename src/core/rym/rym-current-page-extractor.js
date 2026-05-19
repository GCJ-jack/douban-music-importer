export function extractRymCurrentPage(options = {}) {
  const documentRef = options.document || globalThis.document;
  const locationRef = options.location || globalThis.location;
  const warnings = [];

  function text(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function textContent(selector) {
    return text(documentRef?.querySelector?.(selector)?.textContent);
  }

  function allText(selector) {
    return Array.from(documentRef?.querySelectorAll?.(selector) || [])
      .map((node) => text(node.textContent))
      .filter(Boolean);
  }

  function unique(values) {
    return [...new Set(values.map(text).filter(Boolean))];
  }

  function parseUrl(input) {
    try {
      return new URL(input);
    } catch {
      return null;
    }
  }

  function supportedRymReleaseTypes() {
    return ["album", "mixtape", "ep", "single", "comp"];
  }

  function parseRymReleasePage(url) {
    if (!url) return { supported: false, reason: "invalid_url", releaseType: "" };
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean).map((part) => part.toLowerCase());
    if (!["rateyourmusic.com", "www.rateyourmusic.com"].includes(host)) {
      return { supported: false, reason: "unsupported_host", releaseType: "" };
    }

    if (parts[0] !== "release" || !supportedRymReleaseTypes().includes(parts[1]) || parts.length < 4) {
      return { supported: false, reason: "not_rym_release_page", releaseType: parts[1] || "" };
    }

    return { supported: true, reason: "rym_release_page", releaseType: parts[1] };
  }

  function firstNonEmpty(...values) {
    return values.map(text).find(Boolean) || "";
  }

  function explicitTitle() {
    return firstNonEmpty(
      textContent(".album_title"),
      textContent(".release_title"),
      textContent("h1[itemprop='name']")
    );
  }

  function headingTitle() {
    return textContent("h1");
  }

  function explicitArtist() {
    return firstNonEmpty(
      textContent(".artist"),
      textContent(".album_artist"),
      textContent("[itemprop='byArtist']"),
      textContent("a[href*='/artist/']")
    );
  }

  function extractTitleArtist() {
    const artist = explicitArtist();
    const title = firstNonEmpty(explicitTitle(), headingTitle());
    if (!title) {
      return { title: "", artist, warnings: [] };
    }

    if (artist) {
      return {
        title: removeByArtistSuffix(title, artist),
        artist,
        warnings: [],
      };
    }

    const split = splitHeadingByArtist(title);
    if (split) {
      return {
        title: split.title,
        artist: split.artist,
        warnings: [],
      };
    }

    return {
      title,
      artist: "",
      warnings: /\s+by\s+/i.test(title)
        ? [warning("title", "Could not confidently split RYM album heading into title and artist.")]
        : [],
    };
  }

  function splitHeadingByArtist(value) {
    const normalized = text(value);
    const match = normalized.match(/^(.+?)\s+by\s+(.+)$/i);
    if (!match) return null;

    const title = text(match[1]);
    const artist = text(match[2]);
    if (!title || !artist) return null;

    return { title, artist };
  }

  function removeByArtistSuffix(title, artist) {
    const normalizedTitle = text(title);
    const normalizedArtist = text(artist);
    if (!normalizedTitle || !normalizedArtist) return normalizedTitle;

    const suffix = new RegExp(`\\s+by\\s+${escapeRegExp(normalizedArtist)}$`, "i");
    return text(normalizedTitle.replace(suffix, ""));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function fieldRows() {
    const selectors = [
      ".release_info tr",
      ".release_info_row",
      ".info_row",
      ".album_info tr",
      "[class*='release_info'] tr",
    ];
    return selectors.flatMap((selector) => Array.from(documentRef?.querySelectorAll?.(selector) || []));
  }

  function extractFieldByLabel(labels) {
    const labelPattern = new RegExp(`^(${labels.join("|")})\\b\\s*[:：]?\\s*(.+)$`, "i");
    for (const row of fieldRows()) {
      const rowText = text(row.textContent);
      const rowMatch = rowText.match(labelPattern);
      if (rowMatch?.[2]) return rowMatch[2].trim();

      const cells = Array.from(row.querySelectorAll?.("th, td, .label, .value") || [])
        .map((cell) => text(cell.textContent))
        .filter(Boolean);
      for (let index = 0; index < cells.length - 1; index += 1) {
        if (labels.some((label) => new RegExp(`^${label}$`, "i").test(cells[index].replace(/[:：]$/, "")))) {
          return cells.slice(index + 1).join(" ").trim();
        }
      }
    }
    return "";
  }

  function extractReleaseDate() {
    const candidates = [
      textContent("[itemprop='datePublished']"),
      extractFieldByLabel(["Released"]),
    ];

    for (const candidate of candidates) {
      const value = text(candidate)
        .replace(/^released[:：]?\s*/i, "")
        .trim();
      const iso = parseDate(value);
      if (iso) return iso;
    }

    return "";
  }

  function parseDate(value) {
    const iso = value.match(/\b(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?\b/);
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
    const named = value.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
    if (named) {
      const month = monthNames[named[2].toLowerCase()];
      if (month) return `${named[3]}-${month}-${named[1].padStart(2, "0")}`;
    }

    const year = value.match(/\b(19\d{2}|20\d{2})\b/);
    return year ? year[1] : "";
  }

  function extractDelimitedField(labels) {
    const value = extractFieldByLabel(labels);
    if (!value) return [];
    return value.split(/[;,]/).map(text).filter(Boolean);
  }

  function extractGenres() {
    return unique([
      ...allText(".genre"),
      ...allText(".release_pri_genres a"),
      ...allText("a[href*='/genre/']"),
      ...extractDelimitedField(["Genres?", "Primary genres?"]),
    ]);
  }

  function extractDescriptors() {
    return unique([
      ...allText(".descriptor"),
      ...allText(".release_descriptors a"),
      ...extractDelimitedField(["Descriptors?"]),
    ]);
  }

  function extractTracks() {
    const trackSelectors = [
      ".tracklist tr",
      ".tracklist .track",
      ".track_listing tr",
      ".section_tracklisting tr",
      "[class*='tracklist'] tr",
      "[class*='track_listing'] tr",
    ];
    const structuredTracks = extractStructuredTrackRows(trackSelectors);
    if (structuredTracks.length > 0) {
      return structuredTracks;
    }

    const fallbackSelectors = [
      ".tracklist li",
      ".track_listing li",
      ".section_tracklisting li",
      "[class*='tracklist'] li",
    ];
    const containerSelectors = [
      ".tracklist",
      ".track_listing",
      ".section_tracklisting",
      "[class*='tracklist']",
    ];
    const candidates = [
      ...fallbackSelectors.flatMap((selector) => allText(selector)),
      ...containerSelectors.flatMap((selector) => splitTrackContainerText(allText(selector))),
    ];
    return dedupeTracks(candidates.map(parseTrack).filter(Boolean));
  }

  function extractStructuredTrackRows(selectors) {
    const rows = selectors.flatMap((selector) => Array.from(documentRef?.querySelectorAll?.(selector) || []));
    const tracks = [];

    for (const row of rows) {
      const parsed = parseStructuredTrackRow(row);
      if (parsed) tracks.push(parsed);
    }

    return dedupeTracks(tracks);
  }

  function parseStructuredTrackRow(row) {
    const rowText = text(row?.textContent);
    if (!rowText) {
      return null;
    }

    const position = firstStructuredCellText(row, [
      ".track_position",
      ".track_pos",
      ".pos",
      "[class*='position']",
      "[class*='tracknum']",
    ]);
    const title = firstStructuredCellText(row, [
      ".track_title",
      ".title",
      "[class*='title']",
    ]);
    const explicit = normalizeStructuredTrack(position, title);
    if (explicit) return explicit;

    const cells = Array.from(row?.querySelectorAll?.("td, th") || [])
      .map((cell) => text(cell.textContent))
      .filter(Boolean);
    for (let index = 0; index < cells.length - 1; index += 1) {
      const parsed = normalizeStructuredTrack(cells[index], cells[index + 1]);
      if (parsed) return parsed;
    }

    return parseTrack(rowText);
  }

  function firstStructuredCellText(row, selectors) {
    for (const selector of selectors) {
      const value = text(row?.querySelector?.(selector)?.textContent);
      if (value) return value;
    }
    return "";
  }

  function normalizeStructuredTrack(positionValue, titleValue) {
    const position = normalizeTrackPosition(positionValue);
    const title = cleanTrackTitle(titleValue);
    if (!position || !title) return null;
    return { position, title };
  }

  function dedupeTracks(parsedTracks) {
    const seen = new Set();
    const tracks = [];

    for (const parsed of parsedTracks) {
      if (!parsed) continue;

      const key = `${parsed.position.toLowerCase()}\u0000${parsed.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push(`${parsed.position} ${parsed.title}`);
    }

    return tracks;
  }

  function splitTrackContainerText(values) {
    return values.flatMap((value) => String(value || "").split(/\n+/).map(text).filter(Boolean));
  }

  function parseTrack(value) {
    const cleaned = text(value)
      .replace(/\s+\d{1,2}:\d{2}$/, "")
      .trim();
    if (!cleaned || isNoisyTrackText(cleaned)) {
      return null;
    }

    const match = cleaned.match(/^([A-Z]\d{1,2}|\d{1,2}[.)]|\d{2})\s+(.+)$/);
    if (!match) return null;

    const position = normalizeTrackPosition(match[1]);
    const title = cleanTrackTitle(match[2]);
    if (!position || !title || containsAdditionalTrackPosition(title)) {
      return null;
    }

    return { position, title };
  }

  function normalizeTrackPosition(value) {
    const normalized = text(value).replace(/[.)]$/, "");
    return /^([A-Z]\d{1,2}|\d{1,2})$/.test(normalized) ? normalized : "";
  }

  function cleanTrackTitle(value) {
    const cleaned = text(value).replace(/\s+\d{1,2}:\d{2}$/, "").trim();
    return cleaned && !isNoisyTrackText(cleaned) ? cleaned : "";
  }

  function isNoisyTrackText(value) {
    return /Saving\.\.\.|rymQ\(|track_ratings|Entire album/i.test(text(value));
  }

  function containsAdditionalTrackPosition(value) {
    return /\s([A-Z]\d{1,2}|\d{1,2}[.)]|\d{2})\s+\S/.test(text(value));
  }

  function hasReleaseAlbumDom() {
    const titleArtist = extractTitleArtist();
    return Boolean(
      titleArtist.title
      && titleArtist.artist
      && (
        textContent("[itemprop='datePublished']")
        || extractFieldByLabel(["Released"])
        || extractTracks().length > 0
      )
    );
  }

  const url = parseUrl(locationRef?.href || "");
  const rymPage = parseRymReleasePage(url);
  if (!rymPage.supported) {
    return {
      ok: false,
      code: "unsupported_rym_page",
      message: "Current page is not a supported RYM release page.",
      page: {
        supported: false,
        reason: rymPage.reason,
        url: locationRef?.href || "",
        releaseType: rymPage.releaseType,
      },
      warnings,
      extract: null,
    };
  }

  if (!hasReleaseAlbumDom()) {
    return {
      ok: false,
      code: "unsupported_dom",
      message: "Current page DOM is not a supported RYM album release page.",
      page: {
        supported: false,
        reason: "unsupported_dom",
        url: locationRef?.href || "",
      },
      warnings,
      extract: null,
    };
  }

  const titleArtist = extractTitleArtist();
  warnings.push(...titleArtist.warnings);

  const extract = {
    provider: "rym",
    sourceType: "album",
    sourceUrl: url.href,
    releaseType: rymPage.releaseType,
    title: titleArtist.title,
    artist: titleArtist.artist,
    releaseDate: extractReleaseDate(),
    genres: extractGenres(),
    descriptors: extractDescriptors(),
    tracks: extractTracks(),
  };

  if (!extract.title) warnings.push(warning("title", "Could not confidently extract RYM title."));
  if (!extract.artist) warnings.push(warning("artist", "Could not confidently extract RYM artist."));
  if (!extract.releaseDate) warnings.push(warning("releaseDate", "Could not confidently extract RYM release date."));
  if (extract.tracks.length === 0) warnings.push(warning("tracks", "Could not confidently extract RYM tracklist."));

  return {
    ok: true,
    page: {
      supported: true,
      reason: "rym_release_page",
      url: url.href,
      releaseType: rymPage.releaseType,
    },
    warnings,
    extract,
  };

  function warning(field, message) {
    return { field, level: "warning", message };
  }
}
