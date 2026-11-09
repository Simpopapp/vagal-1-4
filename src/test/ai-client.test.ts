/**
 * The provider client is the only code that ever touches the user's own API
 * key (PRD2 E3/E4), so its tests pin two promises: errors arrive as typed
 * `ProviderError`s the UI can translate, and the key never leaks into a
 * message. All fetch calls are mocked — no real network.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { askProviderJson, listModels, ProviderError, testConnection } from "@/lib/ai/client";
import type { ProviderConfig } from "@/lib/ai/providers";

const GROQ: ProviderConfig = { provider: "groq", model: "llama-3.3-70b-versatile" };
const KEY = "sk-test-secret-key";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listModels", () => {
  it("deduplicates, sorts and drops empty ids", async () => {
    mockFetch(() =>
      Promise.resolve(
        jsonResponse(200, {
          data: [{ id: "b-model" }, { id: "a-model" }, { id: "b-model" }, { id: "  " }, { nope: 1 }],
        }),
      ),
    );
    const models = await listModels({ provider: "groq" }, KEY);
    expect(models).toEqual(["a-model", "b-model"]);
  });

  it("sends the key as a bearer token when one exists", async () => {
    const spy = mockFetch(() => Promise.resolve(jsonResponse(200, { data: [] })));
    await listModels({ provider: "groq" }, KEY);
    const init = spy.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  it("omits the Authorization header when there is no key (Ollama, custom)", async () => {
    const spy = mockFetch(() => Promise.resolve(jsonResponse(200, { data: [] })));
    await listModels({ provider: "ollama" }, "");
    const init = spy.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("uses the provider's effective base URL", async () => {
    const spy = mockFetch(() => Promise.resolve(jsonResponse(200, { data: [] })));
    await listModels({ provider: "groq" }, KEY);
    expect(spy.mock.calls[0]?.[0]).toBe("https://api.groq.com/openai/v1/models");
  });

  it("maps an invalid payload to invalid-output", async () => {
    mockFetch(() => Promise.resolve(jsonResponse(200, { unexpected: true })));
    await expect(listModels({ provider: "groq" }, KEY)).rejects.toMatchObject({
      name: "ProviderError",
      kind: "invalid-output",
    });
  });
});

describe("error mapping", () => {
  it("maps 401/403 to auth", async () => {
    mockFetch(() => Promise.resolve(jsonResponse(401, { error: "bad key" })));
    await expect(listModels({ provider: "groq" }, KEY)).rejects.toMatchObject({ kind: "auth" });
  });

  it("maps 402 to credits", async () => {
    mockFetch(() => Promise.resolve(jsonResponse(402, {})));
    await expect(listModels({ provider: "groq" }, KEY)).rejects.toMatchObject({ kind: "credits" });
  });

  it("maps 429 to refused with a rate-limit message", async () => {
    mockFetch(() => Promise.resolve(jsonResponse(429, {})));
    await expect(listModels({ provider: "groq" }, KEY)).rejects.toMatchObject({ kind: "refused" });
  });

  it("maps a rejected fetch to cors (browser cannot tell it from offline)", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(listModels({ provider: "groq" }, KEY)).rejects.toMatchObject({ kind: "cors" });
  });

  it("never includes the API key in an error message", async () => {
    mockFetch(() =>
      Promise.resolve(jsonResponse(500, { error: `upstream rejected ${KEY} badly` })),
    );
    const error = await listModels({ provider: "groq" }, KEY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).message).not.toContain(KEY);
    expect((error as ProviderError).message).toContain("[chave removida]");
  });
});

describe("testConnection", () => {
  it("reports the number of models on success", async () => {
    mockFetch(() =>
      Promise.resolve(jsonResponse(200, { data: [{ id: "m1" }, { id: "m2" }] })),
    );
    await expect(testConnection({ provider: "groq" }, KEY)).resolves.toEqual({ ok: true, models: 2 });
  });
});

describe("askProviderJson", () => {
  const schema = { parse: (v: unknown) => z.object({ ok: z.boolean() }).parse(v) };

  it("refuses to call without a chosen model", async () => {
    const spy = mockFetch(() => Promise.resolve(jsonResponse(200, {})));
    await expect(
      askProviderJson({ config: { provider: "groq" }, apiKey: KEY, system: "s", user: "u", schema }),
    ).rejects.toMatchObject({ kind: "refused" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("posts chat/completions with the configured model and returns validated JSON", async () => {
    const spy = mockFetch(() =>
      Promise.resolve(
        jsonResponse(200, { choices: [{ message: { content: '{"ok":true}' } }] }),
      ),
    );
    const result = await askProviderJson({
      config: GROQ,
      apiKey: KEY,
      system: "sys",
      user: "usr",
      schema,
    });
    expect(result).toEqual({ ok: true });
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      messages: { role: string; content: string }[];
      response_format: { type: string };
    };
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("maps broken JSON to invalid-output", async () => {
    mockFetch(() =>
      Promise.resolve(jsonResponse(200, { choices: [{ message: { content: "not json" } }] })),
    );
    await expect(
      askProviderJson({ config: GROQ, apiKey: KEY, system: "s", user: "u", schema }),
    ).rejects.toMatchObject({ kind: "invalid-output" });
  });

  it("maps a schema rejection to invalid-output", async () => {
    mockFetch(() =>
      Promise.resolve(
        jsonResponse(200, { choices: [{ message: { content: '{"ok":"yes"}' } }] }),
      ),
    );
    await expect(
      askProviderJson({ config: GROQ, apiKey: KEY, system: "s", user: "u", schema }),
    ).rejects.toMatchObject({ kind: "invalid-output" });
  });
});
