/**
 * Word-card generation (PRD 4.3).
 *
 * Server-only: builds the prompt, calls the model through `askJson` (which
 * validates the answer against `wordCardSchema` before anyone sees it) and
 * returns the card. A failure throws `AiUnavailableError`; the caller keeps
 * the word and shows an honest state.
 */

import { askJson } from "./gateway.server";
import { CARD_SYSTEM as SYSTEM } from "./prompts";
import { wordCardSchema } from "./schemas";
import type { Level, WordCard } from "@/lib/types";

export async function generateWordCard(input: {
  headword: string;
  line: string;
  level: Level;
}): Promise<WordCard> {
  return askJson<WordCard>({
    system: SYSTEM,
    user: `Palavra: ${input.headword}\nFrase da música: "${input.line}"\nNível do estudante: ${input.level}`,
    schema: { parse: (value: unknown) => wordCardSchema.parse(value) as WordCard },
    maxOutputTokens: 900,
  });
}
