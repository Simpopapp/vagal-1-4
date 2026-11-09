/**
 * Word-card generation (PRD 4.3).
 *
 * Server-only: builds the prompt, calls the model through `askJson` (which
 * validates the answer against `wordCardSchema` before anyone sees it) and
 * returns the card. A failure throws `AiUnavailableError`; the caller keeps
 * the word and shows an honest state.
 */

import { askJson } from "./gateway.server";
import { wordCardSchema } from "./schemas";
import type { Level, WordCard } from "@/lib/types";

const SYSTEM = `Você monta cards de vocabulário para um brasileiro aprendendo inglês com letras de música.

Para a palavra e a frase dadas, responda em JSON com:
- "headword": a palavra em forma de dicionário;
- "literal": o significado literal da palavra, em português, curto;
- "inContext": o que ela significa NESSA frase e por que foi usada ali, em português — nunca uma cópia do literal;
- "insteadOf": o sinônimo em inglês que um aprendiz provavelmente tentaria usar no lugar, com:
  - "word": o sinônimo;
  - "verdict": "wrong" (errado aqui), "right" (cabe aqui) ou "mcnc" (certo, mas menos cabível nesse contexto);
  - "reason": uma frase curta justificando o veredito;
- "pronunciation": dica de pronúncia opcional;
- "register": "formal" | "neutral" | "informal" | "slang";
- "confidence": de 0 a 1.

Regras: o veredito é sempre um dos três, sem "depende"; o motivo tem uma frase só; nada de inventar contexto fora da frase dada.`;

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
