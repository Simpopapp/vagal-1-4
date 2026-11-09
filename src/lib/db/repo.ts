/**
 * Typed repository over the local store (PRD D1).
 *
 * Every screen reads and writes through this file, so the shapes in
 * `src/lib/types.ts` stay the single source of truth and no component ever
 * touches an IndexedDB index name directly.
 */

import {
  clear,
  getAll,
  get,
  indexAll,
  indexFirst,
  indexRange,
  newId,
  put,
  putMany,
  remove,
} from "./indexeddb";
import { STORES, type StoreName } from "./schema";
import {
  DEFAULT_PROVIDER_CONFIG,
  providerConfigSchema,
  type ProviderConfig,
} from "@/lib/ai/providers";
import type {
  Card,
  Dossier,
  Level,
  QueueItem,
  QueueStatus,
  Review,
  Sense,
  Settings,
  Song,
  TouchMode,
  Word,
  WordStage,
  WordStatus,
} from "@/lib/types";

export { newId };

/* ---------------------------------------------------------------- songs */

export function saveSong(input: Omit<Song, "id"> & { id?: string }): Promise<Song> {
  const song: Song = { ...input, id: input.id ?? newId() };
  return put<Song>(STORES.songs, song);
}

export function getSong(id: string): Promise<Song | undefined> {
  return get<Song>(STORES.songs, id);
}

export function findSongBySourceUrl(sourceUrl: string): Promise<Song | undefined> {
  return indexFirst<Song>(STORES.songs, "bySourceUrl", sourceUrl);
}

export async function listSongs(): Promise<Song[]> {
  const rows = await getAll<Song>(STORES.songs);
  return rows.sort((a, b) => b.addedAt - a.addedAt);
}

/* ---------------------------------------------------------------- words */

/**
 * The lemma is the identity of a vocabulary entry (PRD D7), so a lookup by
 * headword is how a word found in a new song joins the one already studied.
 */
export function findWordByHeadword(headword: string): Promise<Word | undefined> {
  return indexFirst<Word>(STORES.words, "byHeadword", headword);
}

export function getWord(id: string): Promise<Word | undefined> {
  return get<Word>(STORES.words, id);
}

export function saveWord(input: Omit<Word, "id"> & { id?: string }): Promise<Word> {
  const word: Word = { ...input, id: input.id ?? newId() };
  return put<Word>(STORES.words, word);
}

export function saveWords(inputs: (Omit<Word, "id"> & { id?: string })[]): Promise<Word[]> {
  const words: Word[] = inputs.map((input) => ({ ...input, id: input.id ?? newId() }));
  return putMany<Word>(STORES.words, words);
}

export function setWordStage(id: string, stage: WordStage): Promise<Word | undefined> {
  return get<Word>(STORES.words, id).then((word) => {
    if (!word) return undefined;
    const next: Word = { ...word, stage };
    return put<Word>(STORES.words, next).then(() => next);
  });
}

export function setWordStatus(id: string, status: WordStatus): Promise<Word | undefined> {
  return get<Word>(STORES.words, id).then((word) => {
    if (!word) return undefined;
    const next: Word = { ...word, status };
    return put<Word>(STORES.words, next).then(() => next);
  });
}

export function setWordFavorite(id: string, favorite: boolean): Promise<Word | undefined> {
  return get<Word>(STORES.words, id).then((word) => {
    if (!word) return undefined;
    const next: Word = { ...word, favorite };
    return put<Word>(STORES.words, next).then(() => next);
  });
}

export async function listActiveWords(): Promise<Word[]> {
  const rows = await indexAll<Word>(STORES.words, "byStatus", "active");
  return rows.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function listWordsByStage(stage: WordStage): Promise<Word[]> {
  return indexAll<Word>(STORES.words, "byStage", stage);
}

/** Booleans are not valid IndexedDB keys, so favorites are filtered in memory. */
export async function listFavoriteWords(): Promise<Word[]> {
  const rows = await getAll<Word>(STORES.words);
  return rows.filter((word) => word.favorite);
}

/** Dismissed and mastered words stop being suggested in future songs. */
export async function isWordKnownToUser(headword: string): Promise<boolean> {
  const word = await findWordByHeadword(headword);
  if (!word) return false;
  return word.status === "dismissed" || word.stage === "mastered";
}

/* --------------------------------------------------------------- senses */

export function saveSense(input: Omit<Sense, "id"> & { id?: string }): Promise<Sense> {
  const sense: Sense = { ...input, id: input.id ?? newId() };
  return put<Sense>(STORES.senses, sense);
}

export function listSensesByWord(wordId: string): Promise<Sense[]> {
  return indexAll<Sense>(STORES.senses, "byWord", wordId);
}

export function listSensesBySong(songId: string): Promise<Sense[]> {
  return indexAll<Sense>(STORES.senses, "bySong", songId);
}

export function listAllSenses(): Promise<Sense[]> {
  return getAll<Sense>(STORES.senses);
}

/* ---------------------------------------------------------------- cards */

export function saveCard(card: Card): Promise<Card> {
  return put<Card>(STORES.cards, card);
}

export function getCard(wordId: string): Promise<Card | undefined> {
  return get<Card>(STORES.cards, wordId);
}

export async function listCards(): Promise<Card[]> {
  const rows = await getAll<Card>(STORES.cards);
  return rows.sort((a, b) => b.generatedAt - a.generatedAt);
}

/* ------------------------------------------------------------- dossiers */

export function saveDossier(dossier: Dossier): Promise<Dossier> {
  return put<Dossier>(STORES.dossiers, dossier);
}

export function getDossier(wordId: string): Promise<Dossier | undefined> {
  return get<Dossier>(STORES.dossiers, wordId);
}

/* -------------------------------------------------------------- reviews */

export function saveReview(review: Omit<Review, "id"> & { id?: string }): Promise<Review> {
  const row: Review = { ...review, id: review.id ?? newId() };
  return put<Review>(STORES.reviews, row);
}

export function listReviewsByWord(wordId: string): Promise<Review[]> {
  return indexAll<Review>(STORES.reviews, "byWord", wordId);
}

/** Reviews whose due time has arrived, soonest first. */
export function listDueReviews(now: number, limit = 20): Promise<Review[]> {
  return indexRange<Review>(STORES.reviews, "byDue", IDBKeyRange.upperBound(now), limit);
}

export async function countReviews(wordId: string): Promise<number> {
  return (await listReviewsByWord(wordId)).length;
}

/** Words the user has missed at least once — the "difíceis" shelf. */
export async function listDifficultWordIds(): Promise<Set<string>> {
  const reviews = await getAll<Review>(STORES.reviews);
  const ids = new Set<string>();
  for (const review of reviews) if (review.lapseCount > 0) ids.add(review.wordId);
  return ids;
}

/* ---------------------------------------------------------------- queue */

/**
 * Enqueues card generation for a word. `wordId` is the store key, so a second
 * call for the same word is a no-op instead of a duplicate job (PRD D8).
 */
export async function enqueueCard(wordId: string): Promise<boolean> {
  const existing = await get<QueueItem>(STORES.queue, wordId);
  if (existing) return false;
  const now = Date.now();
  await put<QueueItem>(STORES.queue, {
    wordId,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

export function listQueueByStatus(status: QueueStatus): Promise<QueueItem[]> {
  return indexAll<QueueItem>(STORES.queue, "byStatus", status);
}

export async function markQueueItem(
  wordId: string,
  status: QueueStatus,
  lastError?: string,
): Promise<QueueItem | undefined> {
  const existing = await get<QueueItem>(STORES.queue, wordId);
  if (!existing) return undefined;
  const next: QueueItem = {
    ...existing,
    status,
    attempts: existing.attempts + 1,
    updatedAt: Date.now(),
  };
  if (lastError !== undefined) next.lastError = lastError;
  await put<QueueItem>(STORES.queue, next);
  return next;
}

export function dequeueCard(wordId: string): Promise<void> {
  return remove(STORES.queue, wordId);
}

export async function queueDepth(): Promise<number> {
  return (await getAll<QueueItem>(STORES.queue)).length;
}

/* ------------------------------------------------------------- settings */

export function setSetting(key: Settings["key"], value: Settings["value"]): Promise<Settings> {
  return put<Settings>(STORES.settings, { key, value });
}

export async function getSetting<T extends Settings["value"]>(
  key: Settings["key"],
  fallback: T,
): Promise<T> {
  const row = await get<Settings>(STORES.settings, key);
  if (!row) return fallback;
  return row.value as T;
}

export function getLevel(fallback: Level = "b1"): Promise<Level> {
  return getSetting<Level>("level", fallback);
}

export function setLevel(level: Level): Promise<Settings> {
  return setSetting("level", level);
}

export function getTouchMode(fallback: TouchMode = "collect"): Promise<TouchMode> {
  return getSetting<TouchMode>("touchMode", fallback);
}

export function setTouchMode(mode: TouchMode): Promise<Settings> {
  return setSetting("touchMode", mode);
}

/* ---------------------------------------------------- ai provider (PRD2) */

/**
 * The provider configuration syncs across devices; the API key does not —
 * `sync.ts` keeps `aiProviderKey` out of push and pull (PRD2 E3).
 */
export async function getProviderConfig(): Promise<ProviderConfig> {
  const raw = await getSetting<string>("aiProvider", "");
  if (!raw) return DEFAULT_PROVIDER_CONFIG;
  try {
    return providerConfigSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_PROVIDER_CONFIG;
  }
}

export function setProviderConfig(config: ProviderConfig): Promise<Settings> {
  return setSetting("aiProvider", JSON.stringify(providerConfigSchema.parse(config)));
}

/** The user's own API key. Local-only, trimmed, "" when absent. */
export function getProviderKey(): Promise<string> {
  return getSetting<string>("aiProviderKey", "");
}

export function setProviderKey(key: string): Promise<Settings> {
  return setSetting("aiProviderKey", key.trim());
}

/* --------------------------------------------------------------- helper */

/** Wipes the local store. Used by tests and by an explicit "start over". */
export async function resetLocalData(): Promise<void> {
  const names: StoreName[] = Object.values(STORES);
  await Promise.all(names.map((name) => clear(name)));
}
