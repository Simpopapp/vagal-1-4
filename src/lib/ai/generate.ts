/**
 * Generation router (project2, PRD2 E7/seção 5).
 *
 * The queue and the tap-to-open panel never know which provider exists: they
 * ask for a generator and get one. With the default configuration this is the
 * server path (`serverGenerate`, Lovable AI Gateway); with a user provider it
 * is a direct browser call validated by the same zod schema (PRD2 E6).
 *
 * Errors from a user's own provider propagate as `ProviderError` and fail the
 * item — they never pause the whole queue, which is reserved for the
 * workspace running out of credits (PRD2 E8).
 *
 * Browser-only: never imports `*.server.ts`.
 */

import { getProviderConfig, getProviderKey } from "@/lib/db/repo";
import { serverGenerate, type GenerateCardFn } from "@/lib/queue/worker";
import type { WordCard } from "@/lib/types";
import { askProviderJson } from "./client";
import { CARD_SYSTEM } from "./prompts";
import { isCustomProvider } from "./providers";
import { wordCardSchema } from "./schemas";

export async function resolveGenerator(): Promise<GenerateCardFn> {
  const config = await getProviderConfig();
  if (!isCustomProvider(config)) return serverGenerate;

  const apiKey = await getProviderKey();
  return (input) =>
    askProviderJson<WordCard>({
      config,
      apiKey,
      system: CARD_SYSTEM,
      user: `Palavra: ${input.headword}\nFrase da música: "${input.line}"\nNível do estudante: ${input.level}`,
      schema: { parse: (value: unknown) => wordCardSchema.parse(value) as WordCard },
      maxOutputTokens: 900,
    });
}
