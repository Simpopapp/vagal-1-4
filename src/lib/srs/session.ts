/**
 * Builds a practice session (F6).
 *
 * Pure: takes everything the screen needs as data and returns the items in
 * order, so the whole session shape is testable without a database. The
 * grading itself is the user's (self-graded reveal) or a verdict choice —
 * no model involved.
 *
 * Item angles (PRD): the word is always met through the song line it came
 * from, never loose:
 *   context-meaning   — "what does it mean in THIS line?"
 *   synonym-fits      — "would this synonym fit here?" with the 3 verdicts
 *   lyrics-gap        — the line with the word blanked out
 *   confusable-choice — pick between lookalikes (needs the dossier)
 *   reappearance      — the same word in another song, side by side
 */

import { pickNextKind } from "./scheduler";
import type {
  Card,
  Dossier,
  Review,
  ReviewKind,
  Sense,
  Verdict,
  Word,
} from "@/lib/types";

export type SessionItem = {
  wordId: string;
  headword: string;
  surfaceForm: string;
  kind: ReviewKind;
  /** The song line the item is built on. */
  line: string;
  /** What the reveal shows. */
  answer: string;
  /** synonym-fits: the proposed synonym and the verdict that is right. */
  synonym?: string;
  verdict?: Verdict;
  /** reappearance: the line from the other song. */
  otherLine?: string;
  /** confusable-choice: the options to pick from. */
  options?: string[];
  previousGapMs: number;
  lapseCount: number;
};

export type SessionInput = {
  words: Word[];
  cards: Map<string, Card>;
  sensesByWord: Map<string, Sense[]>;
  reviewsByWord: Map<string, Review[]>;
  dossiers: Map<string, Dossier>;
  now: number;
  limit?: number;
};

/** Which angles a word can be asked from, given what exists for it. */
export function availableKinds(
  wordId: string,
  input: Pick<SessionInput, "cards" | "sensesByWord" | "dossiers">,
): ReviewKind[] {
  const kinds: ReviewKind[] = [];
  const card = input.cards.get(wordId);
  const senses = input.sensesByWord.get(wordId) ?? [];
  const dossier = input.dossiers.get(wordId);

  if (card) {
    kinds.push("context-meaning", "synonym-fits", "lyrics-gap");
  }
  if (new Set(senses.map((s) => s.songId)).size >= 2) {
    kinds.push("reappearance");
  }
  if (dossier && dossier.confusables.length > 0) {
    kinds.push("confusable-choice");
  }
  return kinds;
}

function buildItem(
  word: Word,
  kind: ReviewKind,
  input: SessionInput,
  reviews: Review[],
): SessionItem | null {
  const card = input.cards.get(word.id);
  const senses = input.sensesByWord.get(word.id) ?? [];
  const line = senses[0]?.line ?? word.surfaceForm;
  const last = reviews[reviews.length - 1];
  const previousGapMs = last ? input.now - last.reviewedAt : 0;
  const lapseCount = last?.lapseCount ?? 0;

  const base = {
    wordId: word.id,
    headword: word.headword,
    surfaceForm: word.surfaceForm,
    kind,
    line,
    previousGapMs,
    lapseCount,
  };

  switch (kind) {
    case "context-meaning":
      if (!card) return null;
      return { ...base, answer: card.card.inContext };
    case "synonym-fits":
      if (!card) return null;
      return {
        ...base,
        synonym: card.card.insteadOf.word,
        verdict: card.card.insteadOf.verdict,
        answer: card.card.insteadOf.reason,
      };
    case "lyrics-gap":
      return { ...base, answer: word.surfaceForm };
    case "reappearance": {
      const otherSong = senses.find((s) => s.songId !== senses[0]?.songId);
      if (!otherSong) return null;
      return { ...base, otherLine: otherSong.line, answer: card?.card.inContext ?? word.headword };
    }
    case "confusable-choice": {
      const dossier = input.dossiers.get(word.id);
      if (!dossier || dossier.confusables.length === 0) return null;
      const options = [word.headword, ...dossier.confusables.map((c) => c.word)].sort();
      return { ...base, options, answer: word.headword };
    }
  }
}

/**
 * The session queue: what is due comes first (soonest first), then words with
 * a card that have never been reviewed. Each word gets a fresh angle via the
 * scheduler's rotation — never the same kind twice in a row.
 */
export function buildSession(input: SessionInput): SessionItem[] {
  const limit = input.limit ?? 20;
  const items: SessionItem[] = [];
  const seen = new Set<string>();

  const dueWordIds: { wordId: string; dueAt: number }[] = [];
  for (const [wordId, reviews] of input.reviewsByWord) {
    const latest = reviews.reduce((a, b) => (a.dueAt > b.dueAt ? a : b));
    if (latest.dueAt <= input.now) dueWordIds.push({ wordId, dueAt: latest.dueAt });
  }
  dueWordIds.sort((a, b) => a.dueAt - b.dueAt);

  const pushWord = (word: Word) => {
    if (seen.has(word.id) || items.length >= limit) return;
    const kinds = availableKinds(word.id, input);
    if (kinds.length === 0) return;
    const reviews = input.reviewsByWord.get(word.id) ?? [];
    const recentKinds = reviews.map((r) => r.kind);
    const kind = pickNextKind(kinds, recentKinds);
    const item = buildItem(word, kind, input, reviews);
    if (!item) return;
    seen.add(word.id);
    items.push(item);
  };

  for (const { wordId } of dueWordIds) {
    const word = input.words.find((w) => w.id === wordId);
    if (word) pushWord(word);
  }
  for (const word of input.words) {
    if ((input.reviewsByWord.get(word.id) ?? []).length === 0) pushWord(word);
  }

  return items;
}

/** synonym-fits is graded by the verdict, not by self-report. */
export function gradeVerdictChoice(chosen: Verdict, expected: Verdict): boolean {
  return chosen === expected;
}
