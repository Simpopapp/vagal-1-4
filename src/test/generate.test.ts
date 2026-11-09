/**
 * The router decides which provider answers a tap (PRD2 E7/E8): the built-in
 * gateway for the default configuration, the user's own provider otherwise.
 * These tests pin the routing and the rule that a user-provider failure fails
 * the item without ever pausing the queue. The client module is mocked — no
 * real network.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderError } from "@/lib/ai/client";
import { resolveGenerator } from "@/lib/ai/generate";
import { closeDatabase } from "@/lib/db/indexeddb";
import { DB_NAME } from "@/lib/db/schema";
import { resetLocalData, setProviderConfig, setProviderKey } from "@/lib/db/repo";
import { serverGenerate } from "@/lib/queue/worker";
import type { WordCard } from "@/lib/types";

vi.mock("@/lib/ai/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/client")>();
  return { ...original, askProviderJson: vi.fn() };
});

const { askProviderJson } = await import("@/lib/ai/client");
const askMock = vi.mocked(askProviderJson);

const CARD: WordCard = {
  headword: "roll",
  literal: "rolar",
  inContext: "seguir em frente",
  insteadOf: { word: "move", verdict: "mcnc", reason: "cabe, mas perde o ritmo" },
  confidence: 0.9,
};

async function dropDatabase() {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await dropDatabase();
  await resetLocalData();
  askMock.mockReset();
});

describe("resolveGenerator", () => {
  it("returns the server generator for the default configuration", async () => {
    const generate = await resolveGenerator();
    expect(generate).toBe(serverGenerate);
    expect(askMock).not.toHaveBeenCalled();
  });

  it("routes to the user's provider when one is configured", async () => {
    await setProviderConfig({ provider: "groq", model: "llama-3.3-70b-versatile" });
    await setProviderKey("sk-local-key");
    askMock.mockResolvedValue(CARD);

    const generate = await resolveGenerator();
    expect(generate).not.toBe(serverGenerate);

    const card = await generate({ headword: "roll", line: "let it roll", level: "b1" });
    expect(card).toEqual(CARD);
    expect(askMock).toHaveBeenCalledTimes(1);
    const call = askMock.mock.calls[0]?.[0];
    expect(call?.config.provider).toBe("groq");
    expect(call?.apiKey).toBe("sk-local-key");
    expect(call?.user).toContain("let it roll");
  });

  it("propagates a provider failure as-is — never as a queue pause", async () => {
    await setProviderConfig({ provider: "groq", model: "llama-3.3-70b-versatile" });
    await setProviderKey("sk-bad-key");
    askMock.mockRejectedValue(new ProviderError("auth", "chave inválida ou sem permissão"));

    const generate = await resolveGenerator();
    const error = await generate({ headword: "roll", line: "let it roll", level: "b1" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe("auth");
    expect((error as Error).name).not.toBe("QueuePausedError");
  });

  it("reads the configuration fresh on each resolution", async () => {
    await setProviderConfig({ provider: "groq", model: "m" });
    const first = await resolveGenerator();
    await setProviderConfig({ provider: "lovable" });
    const second = await resolveGenerator();
    expect(first).not.toBe(serverGenerate);
    expect(second).toBe(serverGenerate);
  });
});
