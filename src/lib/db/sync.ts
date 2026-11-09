/**
 * Cloud sync (F7, PRD D1/D11).
 *
 * The local store stays the source of truth for the UI; sync is additive and
 * optional. Push upserts local rows under the user's id; pull merges remote
 * rows into IndexedDB. Both are idempotent: songs key on `sourceUrl`, words
 * on `headword`, everything else on its stable local id, so running sync
 * twice changes nothing the second time.
 *
 * Runs in the browser with the user's session — row-level security scopes
 * every query to the signed-in user.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  getAll,
  indexFirst,
  put,
} from "./indexeddb";
import { STORES } from "./schema";
import type { Card, Dossier, Review, Sense, Settings, Song, Word } from "@/lib/types";

export type SyncSummary = {
  pushed: number;
  pulled: number;
};

/**
 * Settings keys that never leave this device (PRD2 E3). The user's own API
 * key lives under `aiProviderKey`; pushing it would store the secret in the
 * cloud, and pulling it would overwrite another device's key. Both directions
 * filter this list, so the protection is structural rather than a caller's
 * responsibility.
 */
export const LOCAL_ONLY_SETTINGS: readonly string[] = ["aiProviderKey"];

/* ------------------------------------------------------------------ push */

export async function pushAll(userId: string): Promise<number> {
  let pushed = 0;

  const songs = await getAll<Song>(STORES.songs);
  if (songs.length > 0) {
    const { error } = await supabase.from("songs").upsert(
      songs.map((s) => ({
        id: s.id,
        user_id: userId,
        artist: s.artist,
        title: s.title,
        source_url: s.sourceUrl,
        lyrics: s.lyrics,
        language: s.language,
        added_at: s.addedAt,
      })),
      { onConflict: "user_id,source_url" },
    );
    if (error) throw new Error(`sync de músicas falhou: ${error.message}`);
    pushed += songs.length;
  }

  const words = await getAll<Word>(STORES.words);
  if (words.length > 0) {
    const { error } = await supabase.from("words").upsert(
      words.map((w) => ({
        id: w.id,
        user_id: userId,
        headword: w.headword,
        surface_form: w.surfaceForm,
        language: w.language,
        level: w.level,
        stage: w.stage,
        status: w.status,
        favorite: w.favorite,
        first_seen_at: w.firstSeenAt,
        last_seen_at: w.lastSeenAt,
      })),
      { onConflict: "user_id,headword" },
    );
    if (error) throw new Error(`sync de palavras falhou: ${error.message}`);
    pushed += words.length;
  }

  const senses = await getAll<Sense>(STORES.senses);
  if (senses.length > 0) {
    const { error } = await supabase.from("senses").upsert(
      senses.map((s) => ({
        id: s.id,
        user_id: userId,
        word_id: s.wordId,
        song_id: s.songId,
        headword: s.headword,
        surface_form: s.surfaceForm,
        line: s.line,
        stanza_index: s.stanzaIndex,
        line_index: s.lineIndex,
        created_at: s.createdAt,
      })),
      { onConflict: "id" },
    );
    if (error) throw new Error(`sync de ocorrências falhou: ${error.message}`);
    pushed += senses.length;
  }

  const cards = await getAll<Card>(STORES.cards);
  if (cards.length > 0) {
    const { error } = await supabase.from("cards").upsert(
      cards.map((c) => ({
        word_id: c.wordId,
        user_id: userId,
        headword: c.headword,
        card: c.card,
        generated_at: c.generatedAt,
      })),
      { onConflict: "word_id" },
    );
    if (error) throw new Error(`sync de cards falhou: ${error.message}`);
    pushed += cards.length;
  }

  const dossiers = await getAll<Dossier>(STORES.dossiers);
  if (dossiers.length > 0) {
    const { error } = await supabase.from("dossiers").upsert(
      dossiers.map((d) => ({
        word_id: d.wordId,
        user_id: userId,
        headword: d.headword,
        dossier: {
          commonUses: d.commonUses,
          collocations: d.collocations,
          register: d.register,
          confusables: d.confusables,
          falseFriends: d.falseFriends,
          avoid: d.avoid,
        },
        generated_at: d.generatedAt,
      })),
      { onConflict: "word_id" },
    );
    if (error) throw new Error(`sync de dossiês falhou: ${error.message}`);
    pushed += dossiers.length;
  }

  const reviews = await getAll<Review>(STORES.reviews);
  if (reviews.length > 0) {
    const { error } = await supabase.from("reviews").upsert(
      reviews.map((r) => ({
        id: r.id,
        user_id: userId,
        word_id: r.wordId,
        kind: r.kind,
        correct: r.correct,
        reviewed_at: r.reviewedAt,
        due_at: r.dueAt,
        lapse_count: r.lapseCount,
      })),
      { onConflict: "id" },
    );
    if (error) throw new Error(`sync de revisões falhou: ${error.message}`);
    pushed += reviews.length;
  }

  const settings = (await getAll<Settings>(STORES.settings)).filter(
    (s) => !LOCAL_ONLY_SETTINGS.includes(s.key),
  );
  if (settings.length > 0) {
    const { error } = await supabase.from("user_settings").upsert(
      settings.map((s) => ({ user_id: userId, key: s.key, value: s.value })),
      { onConflict: "user_id,key" },
    );
    if (error) throw new Error(`sync de ajustes falhou: ${error.message}`);
    pushed += settings.length;
  }

  return pushed;
}

/* ------------------------------------------------------------------ pull */

export async function pullAll(): Promise<number> {
  let pulled = 0;

  const { data: songs, error: songsError } = await supabase.from("songs").select("*");
  if (songsError) throw new Error(`leitura de músicas falhou: ${songsError.message}`);
  for (const row of songs ?? []) {
    const existing = await indexFirst<Song>(STORES.songs, "bySourceUrl", row.source_url);
    if (existing) continue;
    await put<Song>(STORES.songs, {
      id: row.id,
      artist: row.artist,
      title: row.title,
      sourceUrl: row.source_url,
      lyrics: row.lyrics,
      language: row.language as Song["language"],
      addedAt: row.added_at,
    });
    pulled++;
  }

  const { data: words, error: wordsError } = await supabase.from("words").select("*");
  if (wordsError) throw new Error(`leitura de palavras falhou: ${wordsError.message}`);
  for (const row of words ?? []) {
    const existing = await indexFirst<Word>(STORES.words, "byHeadword", row.headword);
    if (existing) continue;
    await put<Word>(STORES.words, {
      id: row.id,
      headword: row.headword,
      surfaceForm: row.surface_form,
      language: row.language as Word["language"],
      level: row.level as Word["level"],
      stage: row.stage as Word["stage"],
      status: row.status as Word["status"],
      favorite: row.favorite,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    });
    pulled++;
  }

  const { data: senses, error: sensesError } = await supabase.from("senses").select("*");
  if (sensesError) throw new Error(`leitura de ocorrências falhou: ${sensesError.message}`);
  for (const row of senses ?? []) {
    await put<Sense>(STORES.senses, {
      id: row.id,
      wordId: row.word_id,
      songId: row.song_id,
      headword: row.headword,
      surfaceForm: row.surface_form,
      line: row.line,
      stanzaIndex: row.stanza_index,
      lineIndex: row.line_index,
      createdAt: row.created_at,
    });
    pulled++;
  }

  const { data: cards, error: cardsError } = await supabase.from("cards").select("*");
  if (cardsError) throw new Error(`leitura de cards falhou: ${cardsError.message}`);
  for (const row of cards ?? []) {
    await put<Card>(STORES.cards, {
      wordId: row.word_id,
      headword: row.headword,
      card: row.card as Card["card"],
      generatedAt: row.generated_at,
    });
    pulled++;
  }

  const { data: dossiers, error: dossiersError } = await supabase.from("dossiers").select("*");
  if (dossiersError) throw new Error(`leitura de dossiês falhou: ${dossiersError.message}`);
  for (const row of dossiers ?? []) {
    const d = row.dossier as Omit<Dossier, "wordId" | "headword" | "generatedAt">;
    await put<Dossier>(STORES.dossiers, {
      wordId: row.word_id,
      headword: row.headword,
      commonUses: d.commonUses,
      collocations: d.collocations,
      register: d.register,
      confusables: d.confusables,
      falseFriends: d.falseFriends,
      avoid: d.avoid,
      generatedAt: row.generated_at,
    });
    pulled++;
  }

  const { data: reviews, error: reviewsError } = await supabase.from("reviews").select("*");
  if (reviewsError) throw new Error(`leitura de revisões falhou: ${reviewsError.message}`);
  for (const row of reviews ?? []) {
    await put<Review>(STORES.reviews, {
      id: row.id,
      wordId: row.word_id,
      kind: row.kind as Review["kind"],
      correct: row.correct,
      reviewedAt: row.reviewed_at,
      dueAt: row.due_at,
      lapseCount: row.lapse_count,
    });
    pulled++;
  }

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("*");
  if (settingsError) throw new Error(`leitura de ajustes falhou: ${settingsError.message}`);
  for (const row of settings ?? []) {
    if (LOCAL_ONLY_SETTINGS.includes(row.key)) continue;
    await put<Settings>(STORES.settings, {
      key: row.key as Settings["key"],
      value: row.value as Settings["value"],
    });
    pulled++;
  }

  return pulled;
}

/** Push then pull; safe to run on every sign-in and on demand. */
export async function syncAll(userId: string): Promise<SyncSummary> {
  const pushed = await pushAll(userId);
  const pulled = await pullAll();
  return { pushed, pulled };
}
