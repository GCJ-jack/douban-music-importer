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

  function isRymAlbumUrl(url) {
    if (!url) return false;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean).map((part) => part.toLowerCase());
    return ["rateyourmusic.com", "www.rateyourmusic.com"].includes(host)
      && parts[0] === "release"
      && parts[1] === "album"
      && parts.length >= 4;
  }

  function pageTextLines() {
    return String(documentRef?.body?.innerText || documentRef?.body?.textContent || "")
      .split(/\n+/)
      .map(text)
      .filter(Boolean);
  }

  function firstNonEmpty(...values) {
    return values.map(text).find(Boolean) || "";
  }

  function extractTitle(lines) {
    const heading = firstNonEmpty(
      textContent(".album_title"),
      textContent(".release_title"),
      textContent("h1[itemprop='name']"),
      textContent("h1")
    );
    if (heading) return heading;

    const titleLine = lines.find((line) => /^title[:：]\s+/i.test(line));
    if (titleLine) return titleLine.replace(/^title[:：]\s+/i, "").trim();

    return "";
  }

  function extractArtist(lines) {
    const artist = firstNonEmpty(
      textContent(".artist"),
      textContent(".album_artist"),
      textContent("[itemprop='byArtist']"),
      textContent("a[href*='/artist/']")
    );
    if (artist) return artist;

    const artistLine = lines.find((line) => /^(artist|by)[:：]\s+/i.test(line));
    if (artistLine) return artistLine.replace(/^(artist|by)[:：]\s+/i, "").trim();

    return "";
  }

  function extractReleaseDate(lines) {
    const candidates = [
      textContent("[itemprop='datePublished']"),
      ...lines.filter((line) => /^(released?|release date|date)[:：]/i.test(line)),
      ...lines.filter((line) => /\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/.test(line)),
      ...lines.filter((line) => /\b\d{4}[-/]\d{1,2}([-/]\d{1,2})?\b/.test(line)),
    ];

    for (const candidate of candidates) {
      const value = text(candidate)
        .replace(/^(released?|release date|date)[:：]\s*/i, "")
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

  function extractDelimitedField(lines, labels) {
    const pattern = new RegExp(`^(${labels.join("|")})[:：]\\s*(.+)$`, "i");
    const line = lines.find((item) => pattern.test(item));
    if (!line) return [];
    const value = line.replace(pattern, "$2");
    return value.split(/[;,]/).map(text).filter(Boolean);
  }

  function extractGenres(lines) {
    return unique([
      ...allText(".genre"),
      ...allText(".release_pri_genres a"),
      ...allText("a[href*='/genre/']"),
      ...extractDelimitedField(lines, ["genres?", "primary genres?"]),
    ]);
  }

  function extractDescriptors(lines) {
    return unique([
      ...allText(".descriptor"),
      ...allText(".release_descriptors a"),
      ...extractDelimitedField(lines, ["descriptors?"]),
    ]);
  }

  function extractTracks(lines) {
    const selectorTracks = allText(".tracklist .track, .tracklist li, [class*='tracklist'] li");
    if (selectorTracks.length) {
      return selectorTracks.map(cleanTrack).filter(Boolean);
    }

    return unique(lines
      .filter((line) => /^(\d{1,2}[.)]\s+|[A-Z]\d{1,2}\s+|\d{1,2}\s+).+/.test(line))
      .map(cleanTrack)
      .filter(Boolean));
  }

  function cleanTrack(value) {
    return text(value).replace(/\s+\d{1,2}:\d{2}$/, "").trim();
  }

  const url = parseUrl(locationRef?.href || "");
  if (!isRymAlbumUrl(url)) {
    return {
      ok: false,
      code: "unsupported_rym_page",
      message: "Current page is not a supported RYM album page.",
      page: {
        supported: false,
        reason: "not_rym_album_page",
        url: locationRef?.href || "",
      },
      warnings,
      extract: null,
    };
  }

  const lines = pageTextLines();
  const extract = {
    provider: "rym",
    sourceType: "album",
    sourceUrl: url.href,
    title: extractTitle(lines),
    artist: extractArtist(lines),
    releaseDate: extractReleaseDate(lines),
    genres: extractGenres(lines),
    descriptors: extractDescriptors(lines),
    tracks: extractTracks(lines),
  };

  if (!extract.title) warnings.push(warning("title", "Could not confidently extract RYM title."));
  if (!extract.artist) warnings.push(warning("artist", "Could not confidently extract RYM artist."));
  if (!extract.releaseDate) warnings.push(warning("releaseDate", "Could not confidently extract RYM release date."));
  if (extract.tracks.length === 0) warnings.push(warning("tracks", "Could not confidently extract RYM tracklist."));

  return {
    ok: true,
    page: {
      supported: true,
      reason: "rym_album_page",
      url: url.href,
    },
    warnings,
    extract,
  };

  function warning(field, message) {
    return { field, level: "warning", message };
  }
}
