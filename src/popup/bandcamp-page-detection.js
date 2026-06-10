export function parseBandcampAlbumPageUrl(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    return { supported: false, reason: "invalid_url" };
  }

  if (!url.hostname.toLowerCase().endsWith(".bandcamp.com")) {
    return { supported: false, reason: "unsupported_host" };
  }

  return /^\/album\/[^/]+\/?$/i.test(url.pathname)
    ? { supported: true, reason: "bandcamp_album_page" }
    : { supported: false, reason: "not_bandcamp_album_page" };
}
