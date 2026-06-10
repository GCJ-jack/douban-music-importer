export const DARK_ANGELS_SOURCE_URL = "https://xumstudios.bandcamp.com/album/dark-angels";

export const DARK_ANGELS_TRACKS = [
  "1 Dark Angels: The Introduction",
  "2 Bloody Mary",
  "3 Leonardo",
  "4 Black Money Hustlas",
  "5 Munnie Train (ft. Dough2x)",
  "6 Bring it Back (ft. Key Nyata)",
  "7 My Thang",
  "8 D.U.R.S. (Hypebeast)",
  "9 Who U Roll Wit (ft. Dough2x)",
  "10 Purple Potion",
  "11 M.O.B.",
  "12 Terror Gang (ft. Kane Grocerys, Black Kray, Pollari, Fauni & Mista Splurge)",
  "13 She Feelin Me",
  "14 Dark Angels: Angels Response",
];

export const DARK_ANGELS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  "@id": DARK_ANGELS_SOURCE_URL,
  mainEntityOfPage: DARK_ANGELS_SOURCE_URL,
  name: "Dark Angels",
  byArtist: { "@type": "MusicGroup", name: "SpaceGhostPurrp" },
  datePublished: "2023-11-20",
  keywords: ["hip-hop/rap", "rap", "trap", "dark trap", "hiphop", "rap & hip-hop", "videogames", "Florida"],
  publisher: { "@type": "Organization", name: "XUM" },
  track: {
    "@type": "ItemList",
    itemListElement: DARK_ANGELS_TRACKS.map((track) => {
      const [position, ...title] = track.split(" ");
      return {
        "@type": "ListItem",
        position: Number(position),
        item: { "@type": "MusicRecording", name: title.join(" ") },
      };
    }),
  },
};
