/**
 * Card generation across the client/server boundary (F4).
 *
 * The queue worker runs in the browser (its state lives in IndexedDB), but
 * the model call is server-only, so this function is the seam. Failures cross
 * the boundary as a typed result, never as a thrown transport error, so the
 * worker can tell "out of credits — pause everything" apart from "this card
 * failed — retry later".
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateWordCard } from "@/lib/ai/card";
import { isCreditExhausted } from "@/lib/ai/gateway.server";
import { LEVELS, type Level, type WordCard } from "@/lib/types";

const input = z.object({
  headword: z.string().min(1).max(80),
  line: z.string().min(1).max(500),
  level: z.enum(LEVELS as [string, ...string[]]),
});

export type GenerateCardResult =
  | { status: "ok"; card: WordCard }
  | { status: "credits" }
  | { status: "failed"; message: string };

export const generateCard = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }): Promise<GenerateCardResult> => {
    try {
      const card = await generateWordCard({
        headword: data.headword,
        line: data.line,
        level: data.level as Level,
      });
      return { status: "ok", card };
    } catch (error) {
      if (isCreditExhausted(error)) return { status: "credits" };
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "falha inesperada",
      };
    }
  });
