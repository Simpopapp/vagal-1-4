/**
 * Lyrics source access (PRD D3/D11).
 *
 * Server-only. Two facts drove this file:
 *   - the old public API paths are gone, so results come from the site's own
 *     suggest endpoint plus the artist page's embedded song list;
 *   - the lyric text lives in a `<div id=lyrics>` whose attributes vary
 *     (e.g. `data-plugin=googleTranslate`), so the selector must not assume an
 *     exact tag.
 *
 * Nothing here may generate text: lyrics are returned exactly as the source
 * has them (PRD D2).
 */

const SUGGEST_URL = "https://suggest.vagalume.com.br/json";
const SOURCE_ORIGIN = "https://www.vagalume.com.br";
const FETCH_TIMEOUT_MS = 8000;

export type SuggestDoc = {
  artist: string;
  title: string;
  /** Canonical path on the source, e.g. "/queen/bohemian-rhapsody.html". */
  url: string;
  /** Artist docs carry no title, so they are a lead, not a result. */
  isArtist: boolean;
};

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`suggest responded ${response.status}`);
  return response.json();
}

/** Prefix-matching suggest: reliable for artist names, weak for titles. */
export async function suggest(query: string): Promise<SuggestDoc[]> {
  const payload = (await getJson(`${SUGGEST_URL}?q=${encodeURIComponent(query)}`)) as {
    response?: { docs?: unknown[] };
  };

  const docs = payload.response?.docs ?? [];
  const out: SuggestDoc[] = [];

  for (const raw of docs) {
    if (raw === null || typeof raw !== "object") continue;
    const doc = raw as Record<string, unknown>;
    const url = typeof doc["url"] === "string" ? doc["url"] : "";
    if (url.length === 0) continue;
    const title = typeof doc["title"] === "string" ? doc["title"] : "";
    const artist = typeof doc["band"] === "string" ? doc["band"] : "";
    out.push({
      artist,
      title,
      url,
      isArtist: title.length === 0 || url.endsWith("/"),
    });
  }

  return out;
}

/**
 * The artist page embeds its song list, which is the authoritative title set —
 * suggest only ever returns ten prefix matches.
 *
 * The links arrive as absolute URLs inside JSON-LD and markup, not as
 * `href="/song.html"`, so both shapes are collected and then narrowed to real
 * song pages (`/<artist>/<song>.html`), dropping album and translation pages.
 */
export async function artistSongLinks(artistPath: string): Promise<string[]> {
  const response = await fetch(`${SOURCE_ORIGIN}${artistPath}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`artist page responded ${response.status}`);
  const html = await response.text();

  const paths = new Set<string>();

  for (const url of html.match(/https?:\/\/www\.vagalume\.com\.br[^"'\s\\<>()]+/g) ?? []) {
    paths.add(url.replace(/^https?:\/\/www\.vagalume\.com\.br/, ""));
  }
  for (const match of html.matchAll(/href="(\/[^"]+)"/g)) {
    const href = match[1];
    if (href) paths.add(href);
  }

  const slug = artistPath.replace(/^\/+|\/+$/g, "");
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const songPage = new RegExp(`^/${escaped}/[^/]+\\.html$`);

  return [...paths].filter(
    (path) => songPage.test(path) && !path.includes("-traducao"),
  );
}

/** Dice coefficient over character bigrams — cheap, stable, good enough to rank. */
export function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();

  const x = norm(a);
  const y = norm(b);
  if (x === y) return x.length === 0 ? 0 : 1;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = (s: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };

  const bx = bigrams(x);
  const by = bigrams(y);
  let shared = 0;
  for (const [gram, count] of bx) {
    const other = by.get(gram);
    if (other) shared += Math.min(count, other);
  }
  return (2 * shared) / (x.length - 1 + y.length - 1);
}

/**
 * Resolves free-text into concrete song pages on the source.
 *
 * Artist first, then that artist's real song list, then a title match — the
 * order that survived testing on difficult cases (accents, translated titles,
 * artists with hundreds of songs).
 */
export async function resolveCandidates(
  artist: string,
  title: string,
): Promise<{ artist: string; title: string; url: string; score: number; reason: string }[]> {
  const seen = new Map<string, { artist: string; title: string; url: string; score: number; reason: string }>();

  // Fallback order (PRD 3.2.5): the full line, then the title alone, then
  // progressively shorter title prefixes — the suggest endpoint is
  // prefix-only, so a typo in a later word ("rapsody") still resolves
  // through a shorter prefix ("bohemian"). The artist alone comes last.
  const queries: string[] = [];
  const push = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length > 0 && !queries.includes(trimmed)) queries.push(trimmed);
  };
  push(`${artist} ${title}`);
  push(title);
  const words = title.split(/\s+/).filter(Boolean);
  for (let k = words.length - 1; k >= 1; k--) push(words.slice(0, k).join(" "));
  push(artist);

  for (const query of queries) {
    let docs: SuggestDoc[];
    try {
      docs = await suggest(query);
    } catch {
      continue;
    }

    for (const doc of docs) {
    if (doc.isArtist) {
      // Follow the artist lead into its authoritative song list.
      try {
        const links = await artistSongLinks(doc.url);
        for (const path of links) {
          const candidateTitle = path
            .split("/")
            .pop()!
            .replace(/\.html$/, "")
            .replace(/-/g, " ");
          const score = Math.max(similarity(candidateTitle, title), similarity(doc.artist, artist) * 0.4);
          if (score < 0.45) continue;
          const key = path;
          const row = {
            artist: doc.artist,
            title: candidateTitle,
            url: path,
            score,
            reason: "encontrada na lista de músicas do artista",
          };
          if (!seen.has(key) || seen.get(key)!.score < score) seen.set(key, row);
        }
      } catch {
        // A failed artist page must not lose the candidates already found.
      }
      continue;
    }

    const score =
      similarity(doc.title, title) * 0.7 + similarity(doc.artist, artist) * 0.3;
    if (score < 0.45) continue;
    const row = {
      artist: doc.artist,
      title: doc.title,
      url: doc.url,
      score,
      reason: "título e artista bateram com a busca",
    };
    if (!seen.has(doc.url) || seen.get(doc.url)!.score < score) seen.set(doc.url, row);
    }

    // A confident hit ends the search: further fallbacks can only add noise.
    const best = Math.max(0, ...[...seen.values()].map((row) => row.score));
    if (best >= 0.85) break;
  }

  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 8);
}

/**
 * Extracts the lyric text verbatim.
 *
 * `<br>` ends a line and a blank line ends a stanza; every other tag is
 * removed. Returns null when the page has no lyric block, which is how the
 * caller distinguishes "not found" from "found but empty".
 */
export function extractLyrics(html: string): string | null {
  const match = /<div[^>]*\bid=["']?lyrics["']?[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const raw = match?.[1];
  if (raw === undefined) return null;

  const text = raw
    // In HTML only <br> breaks a line; newlines in the source are formatting.
    .replace(/\r?\n\s*/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const decoded = decodeEntities(text);
  return decoded.length === 0 ? null : decoded;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

/** Fetches one song page and returns its lyric text exactly as published. */
export async function fetchLyrics(songPath: string): Promise<string | null> {
  const response = await fetch(`${SOURCE_ORIGIN}${songPath}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`song page responded ${response.status}`);
  return extractLyrics(await response.text());
}

export { SOURCE_ORIGIN };
