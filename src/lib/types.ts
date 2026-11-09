/**
 * Central contracts for the whole app.
 *
 * These types are the seam between packages: the lyrics resolver, the card
 * generator, the vocabulary area and the practice scheduler all build against
 * this file and never re-declare these shapes.
 *
 * Rule (PRD D2): `lyrics` is only ever written from the source's own text.
 * No AI output may populate it.
 */

export type LanguageCode = "en" | "pt" | "es" | "fr" | "de" | "it";

export type Level = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

export const LEVELS: readonly Level[] = ["a1", "a2", "b1", "b2", "c1", "c2"];

/** What the AI inferred from the user's raw, unpunctuated search text. */
export type Interpretation = {
  title: string;
  artist: string;
  confidence: number;
  alternatives: { title: string; artist: string }[];
  ambiguous: boolean;
};

/** A concrete song page found on the source, with the confidence it matched. */
export type Candidate = {
  artist: string;
  title: string;
  /** Canonical path on the source, e.g. "/queen/bohemian-rhapsody.html". */
  url: string;
  score: number;
  reason: string;
};

export type Resolved = {
  status: "ok" | "choose" | "none";
  candidates: Candidate[];
  /** Text extracted verbatim from the source. Never model-written (PRD D2). */
  lyrics?: string;
  sourceUrl?: string;
};

export type Verdict = "wrong" | "right" | "mcnc";

export const VERDICTS: readonly Verdict[] = ["wrong", "right", "mcnc"];

export type Register = "formal" | "neutral" | "informal" | "slang";

/** The word card: three translations, each with its own color and icon. */
export type WordCard = {
  headword: string;
  /** Literal meaning of the word itself. Secondary layer. */
  literal: string;
  /** What it means in that line, and why it was used there. The card's hero. */
  inContext: string;
  /** The single most likely synonym a learner would reach for, plus verdict. */
  insteadOf: {
    word: string;
    verdict: Verdict;
    reason: string;
  };
  pronunciation?: string;
  register?: Register;
  confidence: number;
};

/** The dossier deepens over time; generated on demand, not on tap (PRD D9). */
export type Dossier = {
  /** Store key: one dossier per vocabulary entry. */
  wordId: string;
  headword: string;
  commonUses: string[];
  collocations: string[];
  register: Register;
  confusables: { word: string; why: string }[];
  falseFriends: { word: string; means: string }[];
  avoid: string;
  generatedAt: number;
};

/**
 * A generated card as stored locally: the card payload plus the keys the
 * vocabulary and the queue sort and join on.
 */
export type Card = {
  /** Store key: one card per vocabulary entry (PRD D8). */
  wordId: string;
  headword: string;
  card: WordCard;
  generatedAt: number;
};

export type WordStage = "new" | "learning" | "mastered";
export type WordStatus = "active" | "dismissed";

/** A vocabulary entry. Keyed by lemma, not surface form (PRD D7). */
export type Word = {
  id: string;
  headword: string;
  surfaceForm: string;
  language: LanguageCode;
  level: Level;
  stage: WordStage;
  status: WordStatus;
  favorite: boolean;
  firstSeenAt: number;
  lastSeenAt: number;
};

/** One occurrence of a word in one song line — the context that is studied. */
export type Sense = {
  id: string;
  wordId: string;
  songId: string;
  headword: string;
  surfaceForm: string;
  line: string;
  stanzaIndex: number;
  lineIndex: number;
  createdAt: number;
};

export type Song = {
  id: string;
  artist: string;
  title: string;
  sourceUrl: string;
  lyrics: string;
  language: LanguageCode;
  addedAt: number;
};

export type QueueStatus = "pending" | "running" | "done" | "failed";

/** Durability for collect mode: a marked word survives reload and offline. */
export type QueueItem = {
  /** Keyed by wordId so one word can never be queued twice (PRD D8). */
  wordId: string;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
};

export type ReviewKind =
  | "context-meaning"
  | "synonym-fits"
  | "lyrics-gap"
  | "confusable-choice"
  | "reappearance";

export type Review = {
  id: string;
  wordId: string;
  kind: ReviewKind;
  correct: boolean;
  reviewedAt: number;
  /** Epoch ms when the item is due again. */
  dueAt: number;
  /** Consecutive misses; drives a shorter gap and a different angle (PRD D10). */
  lapseCount: number;
};

export type Settings = {
  key: "level" | "touchMode" | "premarking" | "lastSearch";
  value: string | number | boolean;
};

export type TouchMode = "card" | "collect";

export type SearchHistoryEntry = {
  query: string;
  at: number;
};
