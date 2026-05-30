const AOTY_HOSTS = new Set(["albumoftheyear.org", "www.albumoftheyear.org"]);

export function parseAotyManualPaste(input = {}) {
  const text = String(input.text || input.html || "");
  const sourceUrl = cleanString(input.sourceUrl);
  const warnings = [];
  const html = looksLikeHtml(text) ? text : "";
  const plainText = html ? htmlToText(html) : text;
  const lines = normalizeLines(plainText);
  const jsonLd = extractMusicAlbumJsonLd(html);

  const title = firstNonEmpty(
    cleanString(jsonLd?.name),
    extractHtmlText(html, /<h1\b[^>]*class=["'][^"']*\balbumTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i),
    extractTitleFromLines(lines),
  );
  const artist = firstNonEmpty(
    jsonLdArtist(jsonLd),
    extractHtmlText(html, /<[^>]*class=["'][^"']*\bartist\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i),
    extractArtistFromLines(lines, title),
  );
  const releaseDate = firstNonEmpty(
    normalizeDate(jsonLd?.datePublished),
    extractDateFromLines(lines),
  );
  const sourceUrlFromHtml = firstNonEmpty(
    cleanString(jsonLd?.url),
    cleanString(jsonLd?.["@id"]),
    extractHtmlAttribute(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i),
    extractHtmlAttribute(html, /<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["'][^>]*>/i),
  );
  const resolvedSourceUrl = sourceUrl || sourceUrlFromHtml;
  const source = parseAotySourceUrl(resolvedSourceUrl);
  const genres = unique([
    ...normalizeArray(jsonLd?.genre).flatMap(splitDelimited),
    ...extractGenresFromLines(lines),
  ].filter(notPlaceholder));
  const labels = extractLabelFromLines(lines);
  const formats = extractFormatFromLines(lines);
  const tracks = html ? extractHtmlTracks(html) : extractTextTracks(lines);

  if (!tracks.length) {
    warnings.push(warning("release.tracklist", "AOTY pasted text did not include a tracklist."));
  }

  if (lines.some((line) => /^genres?\s*[:：]?\s*-$|^genre\s*-$|^-\s*$/.test(line.toLowerCase())) && genres.length === 0) {
    warnings.push(warning("release.genres", "AOTY genre is missing or placeholder.", "info"));
  }

  return {
    ok: true,
    provider: "aoty",
    sourceType: "album",
    sourceUrl: resolvedSourceUrl,
    sourceId: source.id,
    title,
    artist,
    releaseDate,
    tracks,
    genres,
    tags: [],
    labels,
    formats,
    coverVisible: hasCoverVisibility(html, lines),
    warnings,
  };
}

export function parseAotySourceUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { supported: false, id: "", reason: "invalid_url" };
  }

  if (!AOTY_HOSTS.has(url.hostname.toLowerCase())) {
    return { supported: false, id: "", reason: "unsupported_host" };
  }

  const match = url.pathname.match(/\/album\/(\d+)-/i);
  return match
    ? { supported: true, id: match[1], reason: "aoty_album_page" }
    : { supported: false, id: "", reason: "not_aoty_album_page" };
}

function extractMusicAlbumJsonLd(html) {
  if (!html) return null;
  const matches = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    const parsed = parseJsonLd(match[1]);
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    const flattened = candidates.flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
    const album = flattened.find((item) => {
      const type = normalizeArray(item?.["@type"]).map((value) => String(value).toLowerCase());
      return type.includes("musicalbum") || type.includes("musicrelease");
    });
    if (album) return album;
  }
  return null;
}

function parseJsonLd(value) {
  try {
    return JSON.parse(value.replace(/&quot;/g, "\"").replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
}

function jsonLdArtist(jsonLd) {
  const artist = jsonLd?.byArtist || jsonLd?.artist;
  if (Array.isArray(artist)) {
    return cleanString(artist.map((item) => cleanString(item?.name || item)).filter(Boolean).join(" / "));
  }
  return cleanString(artist?.name || artist);
}

function extractTitleFromLines(lines) {
  const albumIndex = lines.findIndex((line) => /^album$/i.test(line));
  if (albumIndex > 0) return stripNoiseSuffix(lines[albumIndex - 1]);

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^by$/i.test(lines[index + 1])) return stripNoiseSuffix(lines[index]);
  }

  return firstContentLine(lines);
}

function extractArtistFromLines(lines, title) {
  const byIndex = lines.findIndex((line) => /^by$/i.test(line));
  if (byIndex !== -1 && lines[byIndex + 1]) return stripNoiseSuffix(lines[byIndex + 1]);

  const titleIndex = title ? lines.findIndex((line) => cleanString(line) === title) : -1;
  if (titleIndex !== -1) {
    const nearby = lines.slice(titleIndex + 1, titleIndex + 6);
    const by = nearby.findIndex((line) => /^by$/i.test(line));
    if (by !== -1 && nearby[by + 1]) return stripNoiseSuffix(nearby[by + 1]);
    const candidate = nearby.find((line) => !isUiNoiseLine(line) && !isKnownDetailLabel(line));
    if (candidate) return stripNoiseSuffix(candidate);
  }

  return "";
}

function extractDateFromLines(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/release(?:d)?\s+date\s*[:：]?\s*(.+)$/i) ||
      line.match(/^released\s*[:：]?\s*(.+)$/i);
    const value = normalizeDate(inline?.[1] || "");
    if (value) return value;

    if (/^release(?:d)? date$|^released$/i.test(line)) {
      const next = normalizeDate(lines[index + 1] || "");
      if (next) return next;
    }

    const loose = normalizeDate(line);
    if (loose && /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}-\d{2})/i.test(line)) {
      return loose;
    }
  }
  return "";
}

function extractGenresFromLines(lines) {
  const values = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/^(?:primary\s+genres?|secondary\s+genres?|genres?|tags?)\s*[:：]\s*(.+)$/i);
    if (inline) values.push(...splitDelimited(inline[1]));

    if (/^(?:primary\s+genres?|secondary\s+genres?|genres?|tags?)$/i.test(line)) {
      for (const next of lines.slice(index + 1, index + 6)) {
        if (isKnownDetailLabel(next) || isSectionBoundary(next)) break;
        values.push(...splitDelimited(next));
      }
    }
  }
  return values;
}

function extractLabelFromLines(lines) {
  return extractDetailValues(lines, ["label", "labels"]).flatMap(splitDelimited);
}

function extractFormatFromLines(lines) {
  return extractDetailValues(lines, ["format", "formats"]).flatMap(splitDelimited);
}

function extractDetailValues(lines, labels) {
  const values = [];
  const pattern = new RegExp(`^(${labels.join("|")})\\s*[:：]\\s*(.+)$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(pattern);
    if (inline?.[2]) values.push(inline[2]);

    if (labels.some((label) => new RegExp(`^${label}$`, "i").test(line))) {
      const next = lines[index + 1] || "";
      if (next && !isKnownDetailLabel(next) && !isSectionBoundary(next)) values.push(next);
    }
  }
  return unique(values.filter(notPlaceholder));
}

function extractTextTracks(lines) {
  const start = lines.findIndex((line) => /^track\s*list$|^tracklist$/i.test(line));
  const candidates = start === -1 ? lines : lines.slice(start + 1);
  const tracks = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const line = candidates[index];
    if (tracks.length && isTrackSectionEnd(line)) break;
    if (isTrackNoiseLine(line)) continue;

    const parsed = parseTrackLine(line);
    if (parsed) {
      tracks.push(parsed);
      continue;
    }

    if (/^\d{1,3}$/.test(line)) {
      const title = nextTrackTitle(candidates, index + 1);
      if (title) tracks.push(`${line} ${title}`);
    }
  }

  return dedupePositionTitle(tracks);
}

function extractHtmlTracks(html) {
  const tableMatch = html.match(/<[^>]*id=["']tracklist["'][^>]*>[\s\S]*?(?:<\/table>|<\/section>|<\/div>\s*<\/div>)/i);
  const scope = tableMatch?.[0] || html;
  const rows = [...scope.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const tracks = rows.map((row) => {
    const htmlRow = row[1];
    const position = cleanString(extractHtmlText(htmlRow, /<[^>]*class=["'][^"']*\btrackNumber\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)).replace(/[.)]$/, "");
    const title = cleanString(extractHtmlText(htmlRow, /<[^>]*class=["'][^"']*\btrackTitle\b[^"']*["'][^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i) ||
      extractHtmlText(htmlRow, /<[^>]*class=["'][^"']*\btrackTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i));
    return position && title ? `${position} ${stripTrackTitleNoise(title)}` : "";
  }).filter(Boolean);

  return dedupePositionTitle(tracks);
}

function parseTrackLine(line) {
  const match = line.match(/^(\d{1,3})[.)]?\s+(.+)$/);
  if (!match) return "";
  const title = stripTrackTitleNoise(match[2]);
  return title && !isTrackNoiseLine(title) ? `${match[1]} ${title}` : "";
}

function nextTrackTitle(lines, start) {
  for (const line of lines.slice(start, start + 5)) {
    if (isTrackNoiseLine(line)) continue;
    if (/^\d{1,3}$/.test(line)) return "";
    if (isTrackSectionEnd(line)) return "";
    return stripTrackTitleNoise(line);
  }
  return "";
}

function stripTrackTitleNoise(value) {
  return cleanString(value)
    .replace(/\bfeat(?:\.|uring)?\b.*$/i, "")
    .replace(/\b\d+:\d{2}\b/g, "")
    .replace(/\b(?:producer|writer)s?\b.*$/i, "")
    .trim();
}

function isTrackNoiseLine(line) {
  return isUiNoiseLine(line) ||
    /^\d+:\d{2}$/.test(line) ||
    /^(?:[1-9]\d?|100|NR)$/.test(line) ||
    /^feat(?:\.|uring)?\b/i.test(line) ||
    /^interlude$/i.test(line) ||
    /^total length\b/i.test(line) ||
    /^(?:producer|writer)s?$/i.test(line);
}

function isTrackSectionEnd(line) {
  return /^(?:details|producer|writer|credits|user reviews|popular user reviews|recent user reviews|comments|lists|discography|more albums|full discography|you may also like|year end lists|contributions by)$/i.test(line);
}

function isUiNoiseLine(line) {
  return /^(?:overview|user reviews|lists|comments|discography|details|submit correction|rate tracks|add critic rating|sign in|critic score|user score|nr|highly anticipated|purchasing .+|more albums|full discography|contributions by|amazon|apple music|bandcamp|spotify|soundcloud|vinyl)$/i.test(line) ||
    /(?:critic score|user score|comments?|reviews?|rankings?|charts?|amazon|apple music|spotify|soundcloud|purchasing)/i.test(line);
}

function isKnownDetailLabel(line) {
  return /^(?:release(?:d)? date|released|genre|genres|primary genres|secondary genres|tags|label|labels|format|formats)$/i.test(line);
}

function isSectionBoundary(line) {
  return isUiNoiseLine(line) ||
    isTrackSectionEnd(line) ||
    isTrackNoiseLine(line) ||
    /^\d{1,3}[.)]?$/.test(line) ||
    /^track\s*list$|^tracklist$/i.test(line);
}

function hasCoverVisibility(html, lines) {
  return /(?:albumArt|cover|og:image)/i.test(html) || lines.some((line) => /^cover\b/i.test(line));
}

function normalizeDate(value) {
  const raw = cleanString(value);
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

  const dayMonthYear = raw.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (dayMonthYear) {
    const month = monthNames[dayMonthYear[2].toLowerCase()];
    if (month) return `${dayMonthYear[3]}-${month}-${dayMonthYear[1].padStart(2, "0")}`;
  }

  const year = raw.match(/\b(19\d{2}|20\d{2})\b/);
  return year ? year[1] : "";
}

function htmlToText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|td|th|h1|h2|h3|section|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractHtmlText(html, pattern) {
  const match = html.match(pattern);
  return match ? cleanString(htmlToText(match[1])) : "";
}

function extractHtmlAttribute(html, pattern) {
  const match = html.match(pattern);
  return match ? cleanString(match[1]) : "";
}

function looksLikeHtml(value) {
  return /<\s*(?:html|script|div|section|table|h1|meta|link)\b/i.test(value);
}

function normalizeLines(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanString)
    .filter(Boolean);
}

function splitDelimited(value) {
  return cleanString(value)
    .split(/\s*(?:,|;|\||\/)\s*/)
    .map(cleanString)
    .filter(Boolean);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

function dedupePositionTitle(values) {
  return unique(values.map(cleanString).filter(Boolean));
}

function unique(values) {
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function notPlaceholder(value) {
  const cleaned = cleanString(value);
  return Boolean(cleaned) && cleaned !== "-" && !/^n\/a$/i.test(cleaned);
}

function firstContentLine(lines) {
  return stripNoiseSuffix(lines.find((line) => !isUiNoiseLine(line) && !isKnownDetailLabel(line)) || "");
}

function stripNoiseSuffix(value) {
  return cleanString(value).replace(/\s+-\s+Album of the Year.*$/i, "");
}

function firstNonEmpty(...values) {
  return values.map(cleanString).find(Boolean) || "";
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function warning(field, message, level = "warning") {
  return { field, level, message };
}
