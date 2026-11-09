/**
 * The confidence decision (PRD D4).
 *
 * A wrong song delivered with a successful look teaches the wrong language, so
 * the score is part of the product, not a technical detail:
 *   >= 0.85  auto-accept — go straight to the lyrics;
 *   0.55–0.85 ask — show 2–3 "era essa?" cards, never a guess;
 *   < 0.55   stop — ask for more information instead of showing a bad match.
 *
 * Pure and client-safe: the search UI and the server pipeline share this file
 * so the bar is decided in exactly one place.
 */

import type { Candidate } from "@/lib/types";

export const AUTO_ACCEPT_SCORE = 0.85;
export const CHOOSE_MIN_SCORE = 0.55;
export const MAX_CHOICES = 3;

export type SearchDecision =
  | { kind: "auto"; candidate: Candidate }
  | { kind: "choose"; candidates: Candidate[] }
  | { kind: "none" };

export function decideSearch(candidates: Candidate[]): SearchDecision {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  if (!best || best.score < CHOOSE_MIN_SCORE) return { kind: "none" };
  if (best.score >= AUTO_ACCEPT_SCORE) return { kind: "auto", candidate: best };
  return {
    kind: "choose",
    candidates: sorted.filter((c) => c.score >= CHOOSE_MIN_SCORE).slice(0, MAX_CHOICES),
  };
}
