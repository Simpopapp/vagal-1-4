/**
 * The collect-mode generation queue (F4, PRD D8).
 *
 * A tap never waits on the model: it writes the word and enqueues. This
 * worker drains the queue in the background — one item at a time, so a burst
 * of 300 marks never turns into 300 parallel calls.
 *
 * Durability rules:
 *   - the queue lives in IndexedDB and is keyed by wordId, so a reload loses
 *     nothing and the same word can never be generated twice;
 *   - a failed item goes back to `pending` with a backoff timestamp instead
 *     of spinning;
 *   - "out of credits" pauses the whole run — every word stays queued and the
 *     worker tries again later, instead of burning attempts on every item.
 *
 * The generator is injectable so the whole lifecycle is testable offline.
 */

import {
  dequeueCard,
  getWord,
  listQueueByStatus,
  listSensesByWord,
  markQueueItem,
  saveCard,
} from "@/lib/db/repo";
import { generateCard } from "@/lib/songs/cards.functions";
import type { Level, WordCard } from "@/lib/types";

/** Thrown when the workspace is out of AI credits — pauses the whole run. */
export class QueuePausedError extends Error {
  constructor() {
    super("sem créditos de IA");
    this.name = "QueuePausedError";
  }
}

export type GenerateCardFn = (input: {
  headword: string;
  line: string;
  level: Level;
}) => Promise<WordCard>;

/** The real generator: the server function, with credits mapped to a pause. */
export const serverGenerate: GenerateCardFn = async (input) => {
  const result = await generateCard({ data: input });
  if (result.status === "ok") return result.card;
  if (result.status === "credits") throw new QueuePausedError();
  throw new Error(result.message);
};

export const MAX_ATTEMPTS = 5;
export const BACKOFF_BASE_MS = 30_000;

/** How long a failed item waits before its next attempt (2^attempts growth). */
export function backoffMs(attempts: number): number {
  return BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1);
}

export type QueueRunSummary = {
  generated: number;
  failed: number;
  remaining: number;
  paused: boolean;
};

/**
 * Drains what is due now. Returns a summary the indicator can show.
 *
 * Items whose backoff has not elapsed are left untouched; items that exhausted
 * their attempts stay `failed` and stop being retried automatically.
 */
export async function processQueueOnce(
  generate: GenerateCardFn = serverGenerate,
  now: number = Date.now(),
): Promise<QueueRunSummary> {
  const pending = await listQueueByStatus("pending");
  let generated = 0;
  let failed = 0;
  let paused = false;

  for (const item of pending) {
    if (paused) break;
    // Backoff: a retried item waits `backoffMs(attempts)` since its last try.
    if (item.attempts > 0 && now - item.updatedAt < backoffMs(item.attempts)) continue;
    if (item.attempts >= MAX_ATTEMPTS) {
      await markQueueItem(item.wordId, "failed", "tentativas esgotadas");
      continue;
    }

    const word = await getWord(item.wordId);
    if (!word) {
      // The word was removed underneath the queue; the job is meaningless.
      await dequeueCard(item.wordId);
      continue;
    }

    const senses = await listSensesByWord(item.wordId);
    const line = senses[0]?.line ?? word.surfaceForm;

    try {
      const card = await generate({ headword: word.headword, line, level: word.level });
      await saveCard({ wordId: word.id, headword: word.headword, card, generatedAt: now });
      await dequeueCard(item.wordId);
      generated++;
    } catch (error) {
      if (error instanceof QueuePausedError) {
        paused = true;
        break;
      }
      failed++;
      await markQueueItem(
        item.wordId,
        "pending",
        error instanceof Error ? error.message : "falha inesperada",
      );
    }
  }

  const remaining = (await listQueueByStatus("pending")).length;
  return { generated, failed, remaining, paused };
}

export type QueueProgress = {
  /** Words collected in total (done + still queued). */
  total: number;
  /** Words whose card is already generated. */
  ready: number;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * Starts the background loop. Safe to call more than once — a second call is
 * a no-op. The loop reschedules itself with the backoff of the oldest pending
 * item, and pauses quietly while credits are out.
 */
export function startQueueWorker(
  generate: GenerateCardFn = serverGenerate,
  onProgress?: (summary: QueueRunSummary) => void,
): () => void {
  if (timer !== null) return stopQueueWorker;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processQueueOnce(generate);
      onProgress?.(summary);
      const delay = summary.paused
        ? BACKOFF_BASE_MS * 4
        : summary.remaining > 0
          ? BACKOFF_BASE_MS
          : 60_000;
      timer = setTimeout(() => void tick(), delay);
    } finally {
      running = false;
    }
  };

  timer = setTimeout(() => void tick(), 0);
  return stopQueueWorker;
}

export function stopQueueWorker(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}
