/**
 * Language guess for a collected lyric (PRD D12: the app must know which
 * language it is teaching, and the source does not say).
 *
 * Deliberately conservative: it looks for function words that only appear in
 * one language, and falls back to English, which is the corpus's majority.
 */

import type { LanguageCode } from "@/lib/types";

const MARKERS: Record<Exclude<LanguageCode, "en">, string[]> = {
  pt: ["você", "não", "que", "com", "uma", "pra", "coração", "saudade", "amor", "mais"],
  es: ["que", "con", "una", "está", "muy", "corazón", "también", "porque", "nunca"],
  fr: ["je", "ne", "que", "dans", "les", "vous", "pour", "avec", "cette", "être"],
  de: ["und", "nicht", "das", "mit", "für", "über", "ich", "die", "ist", "mein"],
  it: ["che", "non", "con", "una", "per", "sono", "mi", "il", "come", "sempre"],
};

const EN_MARKERS = ["the", "and", "you", "i", "to", "of", "in", "is", "my", "me"];

/** Counts how many of a language's markers appear as whole words. */
function score(text: string, markers: string[]): number {
  const words = new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9']+/)
      .filter(Boolean),
  );
  let hits = 0;
  for (const marker of markers) {
    if (words.has(marker)) hits += 1;
  }
  return hits;
}

export function detectLanguage(lyrics: string): LanguageCode {
  let best: LanguageCode = "en";
  let bestScore = score(lyrics, EN_MARKERS);

  for (const [language, markers] of Object.entries(MARKERS)) {
    const value = score(lyrics, markers);
    if (value > bestScore) {
      bestScore = value;
      best = language as LanguageCode;
    }
  }

  return best;
}
