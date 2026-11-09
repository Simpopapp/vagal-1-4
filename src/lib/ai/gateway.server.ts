/**
 * Shared AI entry point (PRD D5/D6).
 *
 * Every model call in the app goes through `askJson`, so three rules hold in
 * one place instead of being re-decided per feature:
 *   1. the model is the workspace default and appears as a literal slug;
 *   2. the answer is parsed and validated before anyone can render it;
 *   3. a gateway failure becomes one honest error type the UI can show.
 *
 * Server-only: this file reads the gateway from the server environment and is
 * imported only by `*.functions.ts` or `src/routes/api/**`, never by a component.
 */

import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

/** Workspace default for chat/text; `responses` surface, zero data retention. */
export const AI_MODEL = "openai/gpt-6-astra" as const;

export class AiUnavailableError extends Error {
  constructor(
    readonly reason: "credits" | "rate-limit" | "network" | "refused" | "invalid-output",
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Reads the assistant text out of a Responses API payload.
 *
 * The SDK types `output` as a list of items; message items carry a `content`
 * array whose `output_text` parts hold the text. Walking it (rather than
 * assuming a single string) keeps the call working across item shapes.
 */
function collectText(output: readonly unknown[]): string {
  const parts: string[] = [];

  for (const item of output) {
    if (item === null || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (typeof content === "string") {
      parts.push(content);
      continue;
    }
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block === null || typeof block !== "object") continue;
      const b = block as { type?: unknown; text?: unknown };
      if (b.type === "output_text" && typeof b.text === "string") parts.push(b.text);
      else if (typeof b.text === "string" && b.type !== "reasoning") parts.push(b.text);
    }
  }

  return parts.join("").trim();
}

export type AskJsonOptions<T> = {
  /** Role and rules for the model. Not shown to the user. */
  system: string;
  /** The actual task: the word, the line, the raw search text. */
  user: string;
  /** Shape the answer must satisfy before it is returned. */
  schema: { parse: (value: unknown) => T };
  /** Hard ceiling on output so one call cannot run long. */
  maxOutputTokens?: number;
};

/**
 * Asks the model for JSON and returns it only if it validates.
 *
 * Throws `AiUnavailableError` otherwise: the caller keeps the user's input and
 * shows a real failure instead of a half-formed answer.
 */
export async function askJson<T>(options: AskJsonOptions<T>): Promise<T> {
  const { system, user, schema, maxOutputTokens = 1200 } = options;

  let response: Awaited<ReturnType<typeof generateResponse>>;
  try {
    response = await generateResponse({
      model: AI_MODEL,
      instructions: system,
      input: [
        {
          role: "user" as const,
          content: `${user}\n\nReturn only valid JSON matching the requested shape.`,
        },
      ],
      text: { format: { type: "json_object" as const } },
      max_output_tokens: maxOutputTokens,
    });
  } catch (error) {
    throw toAiUnavailable(error);
  }

  const text = collectText(response.output as readonly unknown[]);
  if (text.length === 0) {
    throw new AiUnavailableError(
      "invalid-output",
      "the model returned no text",
      response.incomplete_details,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new AiUnavailableError("invalid-output", "the model did not return valid JSON", error);
  }

  try {
    return schema.parse(payload) as T;
  } catch (error) {
    throw new AiUnavailableError("invalid-output", "the model's answer failed validation", error);
  }
}

function toAiUnavailable(error: unknown): AiUnavailableError {
  if (error instanceof GatewayError) {
    const code = error.code;
    if (code === "payment_required" || error.httpStatus === 402) {
      return new AiUnavailableError(
        "credits",
        "a geração de cards está sem créditos de IA no momento",
        error,
      );
    }
    if (code === "rate_limited" || error.httpStatus === 429) {
      return new AiUnavailableError("rate-limit", "muitas chamadas de uma vez", error);
    }
    if (code === "network_error" || code === "timeout") {
      return new AiUnavailableError("network", "não foi possível falar com a IA", error);
    }
    return new AiUnavailableError("refused", "a IA recusou a chamada", error);
  }
  return new AiUnavailableError("network", "falha inesperada na chamada de IA", error);
}

/** True when a failure means "no credits" — used to pause background work. */
export function isCreditExhausted(error: unknown): boolean {
  return error instanceof AiUnavailableError && error.reason === "credits";
}
