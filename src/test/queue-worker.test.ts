import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { closeDatabase } from "@/lib/db/indexeddb";
import { DB_NAME } from "@/lib/db/schema";
import {
  enqueueCard,
  getCard,
  listQueueByStatus,
  markQueueItem,
  queueDepth,
  saveSense,
  saveWord,
} from "@/lib/db/repo";
import {
  backoffMs,
  MAX_ATTEMPTS,
  processQueueOnce,
  QueuePausedError,
  type GenerateCardFn,
} from "@/lib/queue/worker";
import type { Word, WordCard } from "@/lib/types";

async function dropDatabase() {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function markWord(headword: string): Promise<Word> {
  const word = await saveWord({
    headword,
    surfaceForm: headword,
    language: "en",
    level: "b1",
    stage: "new",
    status: "active",
    favorite: false,
    firstSeenAt: 1,
    lastSeenAt: 1,
  });
  await saveSense({
    wordId: word.id,
    songId: "song-1",
    headword,
    surfaceForm: headword,
    line: `a line with ${headword}`,
    stanzaIndex: 0,
    lineIndex: 0,
    createdAt: 1,
  });
  await enqueueCard(word.id);
  return word;
}

function fakeCard(headword: string): WordCard {
  return {
    headword,
    literal: "literal",
    inContext: "na frase",
    insteadOf: { word: "other", verdict: "mcnc", reason: "motivo" },
    confidence: 0.9,
  };
}

const okGenerate: GenerateCardFn = async ({ headword }) => fakeCard(headword);

describe("queue worker (F4)", () => {
  beforeEach(async () => {
    await dropDatabase();
  });

  it("gera os 12 cards enfileirados e esvazia a fila", async () => {
    const words = [];
    for (let i = 0; i < 12; i++) words.push(await markWord(`word${i}`));

    const summary = await processQueueOnce(okGenerate);

    expect(summary.generated).toBe(12);
    expect(summary.remaining).toBe(0);
    expect(await queueDepth()).toBe(0);
    for (const word of words) {
      expect((await getCard(word.id))?.card.headword).toBe(word.headword);
    }
  });

  it("não gera a mesma palavra duas vezes", async () => {
    const word = await markWord("repeat");
    expect(await enqueueCard(word.id)).toBe(false);

    let calls = 0;
    const counting: GenerateCardFn = async (input) => {
      calls++;
      return fakeCard(input.headword);
    };
    await processQueueOnce(counting);
    expect(calls).toBe(1);
  });

  it("falha de geração devolve o item à fila com o erro registrado", async () => {
    const word = await markWord("fragile");
    const failing: GenerateCardFn = async () => {
      throw new Error("gateway fora do ar");
    };

    const summary = await processQueueOnce(failing);

    expect(summary.failed).toBe(1);
    const [item] = await listQueueByStatus("pending");
    expect(item?.wordId).toBe(word.id);
    expect(item?.attempts).toBe(1);
    expect(item?.lastError).toBe("gateway fora do ar");
  });

  it("sem créditos pausa a rodada e preserva o resto da fila", async () => {
    await markWord("first");
    await markWord("second");
    await markWord("third");
    const pausing: GenerateCardFn = async () => {
      throw new QueuePausedError();
    };

    const summary = await processQueueOnce(pausing);

    expect(summary.paused).toBe(true);
    expect(summary.generated).toBe(0);
    expect(summary.remaining).toBe(3);
  });

  it("respeita o backoff: item recém-falho não é tentado de novo já", async () => {
    const word = await markWord("patient");
    await markQueueItem(word.id, "pending", "falhou"); // attempts = 1, updatedAt = agora

    let calls = 0;
    const counting: GenerateCardFn = async (input) => {
      calls++;
      return fakeCard(input.headword);
    };
    const summary = await processQueueOnce(counting);

    expect(calls).toBe(0);
    expect(summary.remaining).toBe(1);
  });

  it("desiste após MAX_ATTEMPTS marcando como failed", async () => {
    const word = await markWord("hopeless");
    for (let i = 0; i < MAX_ATTEMPTS; i++) await markQueueItem(word.id, "pending", "x");

    const summary = await processQueueOnce(okGenerate, Date.now() + 999_999_999);

    expect(summary.generated).toBe(0);
    const [item] = await listQueueByStatus("failed");
    expect(item?.wordId).toBe(word.id);
  });

  it("a fila sobrevive a um reload no meio da geração", async () => {
    await markWord("survivor");
    await markWord("alsosurvives");

    // Reload: a conexão cai, os registros ficam.
    await closeDatabase();
    expect(await queueDepth()).toBe(2);

    const summary = await processQueueOnce(okGenerate);
    expect(summary.generated).toBe(2);
    expect(await queueDepth()).toBe(0);
  });

  it("backoff cresce em potências de 2", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
  });
});
