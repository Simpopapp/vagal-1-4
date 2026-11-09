/**
 * IndexedDB schema.
 *
 * The browser store is the source of truth for the UI (PRD D1: local-first),
 * so every screen must be able to read what it needs without a session.
 *
 * Keying notes:
 * - `queue` is keyed by `wordId`, which makes "never generate the same word
 *   twice" structural rather than a runtime check (PRD D8).
 * - `words` is keyed by `id` with a unique index on `headword`, so the lemma is
 *   the identity of a vocabulary entry (PRD D7).
 */

export const DB_NAME = "letras-vocab";
export const DB_VERSION = 1;

export const STORES = {
  songs: "songs",
  words: "words",
  senses: "senses",
  cards: "cards",
  dossiers: "dossiers",
  reviews: "reviews",
  queue: "queue",
  settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * Store definitions. `indexes` maps index name -> keyPath (+ options).
 * Additive changes only; a new store or index bumps DB_VERSION.
 */
export const SCHEMA: Record<
  StoreName,
  { keyPath: string; autoIncrement?: boolean; indexes: Record<string, { keyPath: string; unique?: boolean }> }
> = {
  songs: {
    keyPath: "id",
    indexes: {
      bySourceUrl: { keyPath: "sourceUrl", unique: true },
      byAddedAt: { keyPath: "addedAt" },
    },
  },
  words: {
    keyPath: "id",
    indexes: {
      byHeadword: { keyPath: "headword", unique: true },
      byStage: { keyPath: "stage" },
      byStatus: { keyPath: "status" },
      byLanguage: { keyPath: "language" },
      byFavorite: { keyPath: "favorite" },
      byLastSeenAt: { keyPath: "lastSeenAt" },
    },
  },
  senses: {
    keyPath: "id",
    indexes: {
      byWord: { keyPath: "wordId" },
      bySong: { keyPath: "songId" },
    },
  },
  cards: {
    keyPath: "wordId",
    indexes: {
      byGeneratedAt: { keyPath: "generatedAt" },
    },
  },
  dossiers: {
    keyPath: "wordId",
    indexes: {},
  },
  reviews: {
    keyPath: "id",
    indexes: {
      byWord: { keyPath: "wordId" },
      byDue: { keyPath: "dueAt" },
      byReviewedAt: { keyPath: "reviewedAt" },
    },
  },
  queue: {
    keyPath: "wordId",
    indexes: {
      byStatus: { keyPath: "status" },
      byCreatedAt: { keyPath: "createdAt" },
    },
  },
  settings: {
    keyPath: "key",
    indexes: {},
  },
};

/** One card per word, with the timestamp the vocabulary sorts by. */
export type StoredCard = {
  wordId: string;
  headword: string;
  generatedAt: number;
};
