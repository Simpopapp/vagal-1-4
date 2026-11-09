/**
 * App-internal song search and collection (PRD D3/D4).
 *
 * Client code imports this file; the handler bodies run on the server, where
 * the lyrics source can be reached without CORS.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  fetchLyrics,
  resolveCandidates,
  SOURCE_ORIGIN,
} from "@/lib/lyrics/vagalume.server";
import type { Candidate, Resolved } from "@/lib/types";

const searchInput = z.object({
  artist: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
});

export const searchSongs = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ data }): Promise<Candidate[]> => {
    const rows = await resolveCandidates(data.artist, data.title);
    return rows.map((row) => ({
      artist: row.artist,
      title: row.title,
      url: `${SOURCE_ORIGIN}${row.url}`,
      score: row.score,
      reason: row.reason,
    }));
  });

const queryInput = z.object({ query: z.string().min(1).max(200) });

/**
 * Resolves one free-text line — "queen bohemian rhapsody", "legião urbana
 * tempo perdido" — without asking the user to split it.
 *
 * The AI interpretation layer is the intended path (PRD D5); this is the
 * fallback that keeps search working when it is unavailable, by trying the
 * plausible artist/title splits against the source itself.
 */
export const searchByText = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => queryInput.parse(input))
  .handler(async ({ data }): Promise<Candidate[]> => {
    const query = data.query.trim();
    const parts = query.split(/\s+/);

    const attempts: [string, string][] = [[query, query]];
    const firstWord = parts[0] ?? "";
    const rest = parts.slice(1).join(" ");
    const firstTwo = parts.slice(0, 2).join(" ");
    const tail = parts.slice(2).join(" ");

    if (parts.length >= 2 && rest.length > 0) attempts.push([firstWord, rest]);
    if (parts.length >= 3 && tail.length > 0) attempts.push([firstTwo, tail]);

    const best = new Map<string, Candidate>();
    for (const [artist, title] of attempts) {
      if (title.trim().length === 0) continue;
      const rows = await resolveCandidates(artist, title);
      for (const row of rows) {
        const candidate: Candidate = {
          artist: row.artist,
          title: row.title,
          url: `${SOURCE_ORIGIN}${row.url}`,
          score: row.score,
          reason: row.reason,
        };
        const existing = best.get(candidate.url);
        if (!existing || existing.score < candidate.score) best.set(candidate.url, candidate);
      }
    }

    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  });

const collectInput = z.object({ url: z.string().url() });

/**
 * Fetches the lyric text for one candidate.
 *
 * The lyrics are returned straight from the source; nothing here composes or
 * completes a line (PRD D2).
 */
export const collectSong = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => collectInput.parse(input))
  .handler(async ({ data }): Promise<Resolved> => {
    const url = new URL(data.url);
    const lyrics = await fetchLyrics(url.pathname);

    if (lyrics === null) {
      return { status: "none", candidates: [] };
    }

    return {
      status: "ok",
      candidates: [],
      lyrics,
      sourceUrl: url.toString(),
    };
  });
