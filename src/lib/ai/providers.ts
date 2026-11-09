/**
 * AI provider catalog and configuration (project2, PRD2 seção 3/4).
 *
 * The default provider is the Lovable AI Gateway — calls stay server-side and
 * need no key. Every other entry is an OpenAI-compatible endpoint the browser
 * calls directly with the user's own key (PRD2 E2/E4). The key itself lives
 * under a local-only settings key and never syncs (PRD2 E3).
 *
 * Browser-safe: no server imports, no environment reads.
 */

import { z } from "zod";

export type ProviderId =
  | "lovable"
  | "openai"
  | "groq"
  | "openrouter"
  | "together"
  | "mistral"
  | "deepseek"
  | "gemini"
  | "ollama"
  | "custom";

export type ProviderDef = {
  id: ProviderId;
  name: string;
  /** Empty for `lovable` (server-side gateway); editable when `custom`. */
  baseUrl: string;
  needsKey: boolean;
  /** Shown as a "grátis" badge: the provider has a free option (PRD2 Q1). */
  freeTier: boolean;
  /** Where the user gets an API key, when one is needed. */
  keyUrl?: string;
  /** Curated list used when the provider's `/models` endpoint fails (PRD2 E5). */
  fallbackModels: string[];
};

/**
 * Display order is deliberate: the default first, then free options, then
 * paid, then local/custom (PRD2 Q1).
 */
export const PROVIDERS: readonly ProviderDef[] = [
  {
    id: "lovable",
    name: "Lovable Cloud (padrão)",
    baseUrl: "",
    needsKey: false,
    freeTier: false,
    fallbackModels: [],
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    freeTier: true,
    keyUrl: "https://console.groq.com/keys",
    fallbackModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    freeTier: true,
    keyUrl: "https://openrouter.ai/keys",
    fallbackModels: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-chat-v3-0324:free",
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    needsKey: true,
    freeTier: true,
    keyUrl: "https://aistudio.google.com/apikey",
    fallbackModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
    freeTier: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    fallbackModels: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
  },
  {
    id: "together",
    name: "Together",
    baseUrl: "https://api.together.xyz/v1",
    needsKey: true,
    freeTier: true,
    keyUrl: "https://api.together.ai/settings/api-keys",
    fallbackModels: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
    ],
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
    freeTier: true,
    fallbackModels: ["llama3.1", "qwen2.5", "mistral"],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    freeTier: false,
    keyUrl: "https://platform.openai.com/api-keys",
    fallbackModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    needsKey: true,
    freeTier: false,
    keyUrl: "https://platform.deepseek.com/api_keys",
    fallbackModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "custom",
    name: "Outro provedor…",
    baseUrl: "",
    needsKey: false,
    freeTier: false,
    fallbackModels: [],
  },
] as const;

export type ProviderConfig = {
  provider: ProviderId;
  /** Required when `provider === "custom"`; override allowed for `ollama`. */
  baseUrl?: string;
  /** Chosen model; empty means the provider's own default. */
  model?: string;
};

const providerIds = PROVIDERS.map((p) => p.id) as [ProviderId, ...ProviderId[]];

export const providerConfigSchema = z
  .object({
    provider: z.enum(providerIds),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.provider === "custom") {
      const url = config.baseUrl?.trim() ?? "";
      if (!/^https?:\/\/.+/.test(url)) {
        ctx.addIssue({
          code: "custom",
          path: ["baseUrl"],
          message: "a URL base precisa começar com http:// ou https://",
        });
      }
    }
  }) as z.ZodType<ProviderConfig>;

export function getProviderDef(id: ProviderId): ProviderDef {
  const def = PROVIDERS.find((p) => p.id === id);
  if (!def) throw new Error(`provedor desconhecido: ${id}`);
  return def;
}

/** True when calls leave the built-in gateway and go to a user provider. */
export function isCustomProvider(config: ProviderConfig): boolean {
  return config.provider !== "lovable";
}

/** The effective base URL: the catalog's, or the user's when overridden. */
export function effectiveBaseUrl(config: ProviderConfig): string {
  const override = config.baseUrl?.trim();
  if (override) return override.replace(/\/+$/, "");
  return getProviderDef(config.provider).baseUrl.replace(/\/+$/, "");
}

/** The default configuration: the built-in gateway, no key, no model pick. */
export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = { provider: "lovable" };
