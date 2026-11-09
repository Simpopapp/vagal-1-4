/**
 * The provider catalog is the contract every other piece of project2 builds
 * against (PRD2 seção 3/4): the settings UI renders it, the client calls its
 * base URLs, and the sync filter trusts its key rules. These tests pin the
 * catalog's shape so a careless edit can't quietly drop the free options or
 * break the custom-provider validation.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROVIDER_CONFIG,
  PROVIDERS,
  effectiveBaseUrl,
  getProviderDef,
  isCustomProvider,
  providerConfigSchema,
} from "@/lib/ai/providers";

describe("catalog", () => {
  it("keeps the built-in gateway first and marked as the default", () => {
    const first = PROVIDERS[0];
    expect(first?.id).toBe("lovable");
    expect(first?.needsKey).toBe(false);
    expect(DEFAULT_PROVIDER_CONFIG).toEqual({ provider: "lovable" });
  });

  it("offers free alternatives right after the default", () => {
    const free = PROVIDERS.filter((p) => p.freeTier).map((p) => p.id);
    expect(free).toContain("groq");
    expect(free).toContain("openrouter");
    expect(free).toContain("gemini");
    expect(free).toContain("mistral");
    expect(free).toContain("together");
    expect(free).toContain("ollama");
  });

  it("gives every non-default provider a usable base URL or an editable one", () => {
    for (const def of PROVIDERS) {
      if (def.id === "lovable") continue;
      if (def.id === "custom") {
        expect(def.baseUrl).toBe("");
        continue;
      }
      expect(def.baseUrl).toMatch(/^https?:\/\/.+/);
    }
  });

  it("gives every key-based provider a page where the user gets the key", () => {
    for (const def of PROVIDERS) {
      if (def.needsKey) expect(def.keyUrl).toMatch(/^https:\/\//);
    }
  });

  it("never leaves a listed provider without a fallback model list", () => {
    for (const def of PROVIDERS) {
      if (def.id === "lovable" || def.id === "custom") continue;
      expect(def.fallbackModels.length).toBeGreaterThan(0);
    }
  });

  it("has unique ids", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("providerConfigSchema", () => {
  it("accepts the default configuration", () => {
    expect(providerConfigSchema.parse({ provider: "lovable" })).toEqual({ provider: "lovable" });
  });

  it("accepts a catalog provider with a chosen model", () => {
    const parsed = providerConfigSchema.parse({ provider: "groq", model: "llama-3.3-70b-versatile" });
    expect(parsed.model).toBe("llama-3.3-70b-versatile");
  });

  it("rejects a custom provider without an http(s) base URL", () => {
    expect(() => providerConfigSchema.parse({ provider: "custom" })).toThrow();
    expect(() => providerConfigSchema.parse({ provider: "custom", baseUrl: "api.exemplo.com" })).toThrow();
    expect(() => providerConfigSchema.parse({ provider: "custom", baseUrl: "ftp://x" })).toThrow();
  });

  it("accepts a custom provider with a valid base URL", () => {
    const parsed = providerConfigSchema.parse({
      provider: "custom",
      baseUrl: "https://api.exemplo.com/v1",
      model: "meu-modelo",
    });
    expect(parsed.baseUrl).toBe("https://api.exemplo.com/v1");
  });

  it("rejects an unknown provider id", () => {
    expect(() => providerConfigSchema.parse({ provider: "anthropic" })).toThrow();
  });
});

describe("helpers", () => {
  it("treats only the built-in gateway as non-custom", () => {
    expect(isCustomProvider({ provider: "lovable" })).toBe(false);
    expect(isCustomProvider({ provider: "groq" })).toBe(true);
    expect(isCustomProvider({ provider: "custom", baseUrl: "https://x.io/v1" })).toBe(true);
  });

  it("resolves the base URL from the catalog, with override and trailing-slash cleanup", () => {
    expect(effectiveBaseUrl({ provider: "groq" })).toBe("https://api.groq.com/openai/v1");
    expect(effectiveBaseUrl({ provider: "ollama", baseUrl: "http://192.168.0.10:11434/v1/" })).toBe(
      "http://192.168.0.10:11434/v1",
    );
    expect(effectiveBaseUrl({ provider: "custom", baseUrl: "https://api.exemplo.com/v1/" })).toBe(
      "https://api.exemplo.com/v1",
    );
  });

  it("throws on an unknown provider id instead of returning undefined", () => {
    expect(() => getProviderDef("nope" as never)).toThrow();
  });
});
