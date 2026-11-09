import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { closeDatabase } from "@/lib/db/indexeddb";
import { DB_NAME } from "@/lib/db/schema";
import {
  dequeueCard,
  enqueueCard,
  findSongBySourceUrl,
  findWordByHeadword,
  getCard,
  getSetting,
  listActiveWords,
  listDueReviews,
  markQueueItem,
  queueDepth,
  resetLocalData,
  saveCard,
  saveReview,
  saveSense,
  saveSong,
  saveWord,
  setLevel,
  setWordFavorite,
  setWordStage,
} from "@/lib/db/repo";
import type { Word } from "@/lib/types";

async function dropDatabase() {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function word(headword: string, over: Partial<Word> = {}): Omit<Word, "id"> {
  return {
    headword,
    surfaceForm: headword,
    language: "en",
    level: "b1",
    stage: "new",
    status: "active",
    favorite: false,
    firstSeenAt: 1,
    lastSeenAt: 1,
    ...over,
  };
}

describe("local store", () => {
  beforeEach(async () => {
    await dropDatabase();
  });

  it("round-trips a song and finds it back by source url", async () => {
    const song = await saveSong({
      artist: "Queen",
      title: "Bohemian Rhapsody",
      sourceUrl: "/queen/bohemian-rhapsody.html",
      lyrics: "Is this the real life?",
      language: "en",
      addedAt: 10,
    });

    const byId = await findSongBySourceUrl("/queen/bohemian-rhapsody.html");
    expect(byId?.id).toBe(song.id);
    expect(byId?.lyrics).toContain("real life");
  });

  it("looks a word up by headword, so a reappearance joins the entry", async () => {
    await saveWord(word("fly", { surfaceForm: "flying" }));

    const found = await findWordByHeadword("fly");
    expect(found?.surfaceForm).toBe("flying");
    expect(await findWordByHeadword("flight")).toBeUndefined();
  });

  it("keeps the headword index unique", async () => {
    await saveWord(word("easy"));
    await expect(saveWord(word("easy", { surfaceForm: "easier" }))).rejects.toThrow();
  });

  it("lists only active words, so dismissed ones stop surfacing", async () => {
    await saveWord(word("easy"));
    await saveWord(word("landslide", { status: "dismissed" }));

    const active = await listActiveWords();
    expect(active.map((w) => w.headword)).toEqual(["easy"]);
  });

  it("moves a word through its learning stage", async () => {
    const saved = await saveWord(word("poor"));
    const updated = await setWordStage(saved.id, "mastered");
    expect(updated?.stage).toBe("mastered");

    const again = await findWordByHeadword("poor");
    expect(again?.stage).toBe("mastered");
  });

  it("flags a favourite without touching other fields", async () => {
    const saved = await saveWord(word("mama"));
    await setWordFavorite(saved.id, true);
    const again = await findWordByHeadword("mama");
    expect(again?.favorite).toBe(true);
    expect(again?.stage).toBe("new");
  });

  it("attaches a sense to the word and the song it came from", async () => {
    const saved = await saveWord(word("fantasy"));
    const song = await saveSong({
      artist: "Queen",
      title: "Bohemian Rhapsody",
      sourceUrl: "/queen/bohemian-rhapsody.html",
      lyrics: "Is this just fantasy?",
      language: "en",
      addedAt: 1,
    });
    await saveSense({
      wordId: saved.id,
      songId: song.id,
      headword: "fantasy",
      surfaceForm: "fantasy",
      line: "Is this just fantasy?",
      stanzaIndex: 0,
      lineIndex: 1,
      createdAt: 2,
    });

    const found = await findWordByHeadword("fantasy");
    expect(found?.id).toBe(saved.id);
  });

  it("stores one card per word and reads it back", async () => {
    const saved = await saveWord(word("easy"));
    await saveCard({
      wordId: saved.id,
      headword: "easy",
      generatedAt: 5,
      card: {
        headword: "easy",
        literal: "que não exige esforço",
        inContext: "diz que a vida leva e traz sem apego",
        insteadOf: { word: "simple", verdict: "mcnc", reason: "fala de complexidade, não de peso" },
        confidence: 0.9,
      },
    });

    const card = await getCard(saved.id);
    expect(card?.card.insteadOf.verdict).toBe("mcnc");
  });

  it("never queues the same word twice", async () => {
    const saved = await saveWord(word("thunder"));
    expect(await enqueueCard(saved.id)).toBe(true);
    expect(await enqueueCard(saved.id)).toBe(false);
    expect(await queueDepth()).toBe(1);
  });

  it("keeps a queued word across a reload, and lets it finish", async () => {
    const saved = await saveWord(word("lantern"));
    await enqueueCard(saved.id);

    // A reload drops the connection; the record must still be there.
    await closeDatabase();
    expect(await queueDepth()).toBe(1);

    const marked = await markQueueItem(saved.id, "done");
    expect(marked?.status).toBe("done");
    expect(marked?.attempts).toBe(1);

    await dequeueCard(saved.id);
    expect(await queueDepth()).toBe(0);
  });

  it("returns reviews whose due time has arrived, soonest first", async () => {
    const a = await saveWord(word("slide"));
    const b = await saveWord(word("blow"));
    await saveReview({
      wordId: a.id,
      kind: "context-meaning",
      correct: true,
      reviewedAt: 100,
      dueAt: 100,
      lapseCount: 0,
    });
    await saveReview({
      wordId: b.id,
      kind: "lyrics-gap",
      correct: false,
      reviewedAt: 100,
      dueAt: 50,
      lapseCount: 1,
    });
    await saveReview({
      wordId: a.id,
      kind: "synonym-fits",
      correct: true,
      reviewedAt: 100,
      dueAt: 900,
      lapseCount: 0,
    });

    const due = await listDueReviews(120);
    expect(due.map((r) => r.dueAt)).toEqual([50, 100]);
  });

  it("remembers the declared level", async () => {
    expect(await getSetting("level", "b1")).toBe("b1");
    await setLevel("a2");
    expect(await getSetting("level", "b1")).toBe("a2");
  });

  it("wipes everything on reset", async () => {
    await saveWord(word("gone"));
    await resetLocalData();
    expect(await listActiveWords()).toEqual([]);
  });
});
