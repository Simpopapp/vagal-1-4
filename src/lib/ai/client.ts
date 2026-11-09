/**
 * OpenAI-compatible provider client (project2, PRD2 E2/E4).
 *
 * When the user configures their own provider, calls leave the built-in
 * gateway and go straight from the browser to the provider with the user's
 * local key — the server never sees the key (PRD2 E3). One client covers
 * every catalog entry plus custom base URLs, because they all speak
 * `chat/completions` + `models`.
 *
 * Browser-only: never imports `*.server.ts`. The key is never logged and is
 * redacted from any provider error body before it becomes a message.
 */

import { effectiveBaseUrl, type ProviderConfig } from "./providers";

export type ProviderErrorKind =
  | "auth"
  | "credits"
  | "cors"
  | "network"
  | "invalid-output"
  | "refused";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** The provider's error body may echo the key back; strip it before showing. */
function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join("[chave removida]") : text;
}

async function request(
  config: ProviderConfig,
  apiKey: string,
  endpoint: string,
  body?: unknown,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${effectiveBaseUrl(config)}${endpoint}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(30_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      // The browser cannot tell "no connection" apart from a CORS refusal.
      throw new ProviderError(
        "cors",
        "sem conexão, ou o provedor não aceita chamadas diretas do navegador",
        error,
      );
    }
    throw new ProviderError(
      "network",
      "falha de rede ou tempo limite ao falar com o provedor",
      error,
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("auth", "chave inválida ou sem permissão");
    }
    if (response.status === 402) {
      throw new ProviderError("credits", "sem saldo nesse provedor");
    }
    if (response.status === 429) {
      throw new ProviderError(
        "refused",
        "limite de requisições do provedor; tente novamente em instantes",
      );
    }
    const text = await response.text().catch(() => "");
    throw new ProviderError(
      "refused",
      redact(
        `o provedor recusou a chamada (${response.status})${text ? `: ${text}` : ""}`,
        apiKey,
      ),
    );
  }
  return response;
}

/** Lists the provider's models, deduplicated and sorted (PRD2 E5). */
export async function listModels(
  config: ProviderConfig,
  apiKey: string,
): Promise<string[]> {
  const response = await request(config, apiKey, "/models");
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("data" in payload) ||
      !Array.isArray((payload as { data: unknown }).data)
    ) {
      throw new Error("unexpected shape");
    }
    const ids = (payload as { data: unknown[] }).data.flatMap((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("id" in entry) ||
        typeof (entry as { id: unknown }).id !== "string"
      ) {
        return [];
      }
      const id = (entry as { id: string }).id.trim();
      return id ? [id] : [];
    });
    return [...new Set(ids)].sort();
  } catch {
    throw new ProviderError(
      "invalid-output",
      "o provedor devolveu uma lista de modelos inválida",
    );
  }
}

/** A real round-trip: lists models and reports how many came back. */
export async function testConnection(
  config: ProviderConfig,
  apiKey: string,
): Promise<{ ok: true; models: number }> {
  const models = await listModels(config, apiKey);
  return { ok: true, models: models.length };
}

/**
 * Asks the user's provider for JSON and returns it only if it validates —
 * the same rule the server path enforces (PRD2 E6).
 */
export async function askProviderJson<T>(options: {
  config: ProviderConfig;
  apiKey: string;
  system: string;
  user: string;
  schema: { parse: (value: unknown) => T };
  maxOutputTokens?: number;
}): Promise<T> {
  const { config, apiKey, system, user, schema, maxOutputTokens } = options;
  if (!config.model?.trim()) {
    throw new ProviderError("refused", "nenhum modelo escolhido");
  }

  const response = await request(config, apiKey, "/chat/completions", {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxOutputTokens ?? 900,
  });

  try {
    const payload: unknown = await response.json();
    const content = (payload as { choices?: { message?: { content?: unknown } }[] })
      .choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("no content");
    return schema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "invalid-output",
      "o provedor devolveu uma resposta inválida",
      error,
    );
  }
}
