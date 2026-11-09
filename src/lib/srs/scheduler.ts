/**
 * The review scheduler (F6).
 *
 * Owns the rule the planning asks for and nothing else: getting a word wrong
 * brings it back sooner and from a different angle, getting it right pushes it
 * further out. It is pure — no storage, no clock of its own — so the spacing is
 * checkable without a database.
 *
 * Deliberately not an off-the-shelf algorithm: the product only needs the two
 * behaviours above, and a rule you can read is a rule you can defend.
 */

import type { ReviewKind } from "@/lib/types";

export const SECONDS = 1_000;
export const MINUTES = 60 * SECONDS;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;

/** First successful contact: come back in ten minutes. */
export const FIRST_GAP = 10 * MINUTES;
/** A miss always brings the word back the same sitting. */
export const WRONG_GAP = 10 * MINUTES;
/** Nothing is scheduled further out than a month. */
export const MAX_GAP = 30 * DAYS;
/** A clean success multiplies the previous gap. */
export const EASE = 2.3;
/** After a lapse the next success is trusted less, so the gap grows slower. */
export const LAPSE_PENALTY = 0.5;

/**
 * How long until the word is worth showing again.
 *
 * `previousGapMs` is 0 for a word that has never been reviewed.
 */
export function nextGapMs(previousGapMs: number, correct: boolean, lapseCount: number): number {
  if (!correct) return WRONG_GAP;
  if (previousGapMs <= 0) return FIRST_GAP;
  const grown = previousGapMs * EASE * (lapseCount > 0 ? LAPSE_PENALTY : 1);
  return Math.min(Math.round(grown / SECONDS) * SECONDS, MAX_GAP);
}

/** Consecutive misses: a success clears the streak, a miss lengthens it. */
export function nextLapseCount(correct: boolean, lapseCount: number): number {
  return correct ? 0 : lapseCount + 1;
}

/** The full plan for the next visit to a word. */
export function planReview(input: {
  previousGapMs: number;
  correct: boolean;
  lapseCount: number;
  now: number;
}): { gapMs: number; dueAt: number; lapseCount: number } {
  const gapMs = nextGapMs(input.previousGapMs, input.correct, input.lapseCount);
  return {
    gapMs,
    dueAt: input.now + gapMs,
    lapseCount: nextLapseCount(input.correct, input.lapseCount),
  };
}

/**
 * Choose which angle to ask from next.
 *
 * The same word is never asked twice from the same angle while other angles
 * remain, and the choice rotates through what is available, so a word that
 * keeps coming back is met from different sides (PRD D10).
 */
export function pickNextKind(available: ReviewKind[], recent: ReviewKind[]): ReviewKind {
  if (available.length === 0) throw new Error("pickNextKind needs at least one kind");
  const last = recent[recent.length - 1];
  const pool = available.filter((kind) => kind !== last);
  const candidates = pool.length > 0 ? pool : available;
  const chosen = candidates[recent.length % candidates.length];
  if (chosen === undefined) throw new Error("pickNextKind found no candidate");
  return chosen;
}
