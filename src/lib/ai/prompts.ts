/**
 * Shared prompts (project2, PRD2 seção 5).
 *
 * Browser-safe: no server imports, so both the server path (`card.ts`) and
 * the direct-provider path (`generate.ts`) use the exact same prompt text.
 */

export const CARD_SYSTEM = `Você monta cards de vocabulário para um brasileiro aprendendo inglês com letras de música.

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
