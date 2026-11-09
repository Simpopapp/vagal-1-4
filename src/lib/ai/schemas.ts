/**
 * Validation for everything a model returns (PRD D6).
 *
 * A card with a broken verdict poisons spaced repetition forever, so nothing
 * reaches the screen without passing here first. Schemas are shared between
 * the server (which validates right after the model answers) and tests.
 */

import { z } from "zod";

export const verdictSchema = z.enum(["wrong", "right", "mcnc"]);

export const registerSchema = z.enum(["formal", "neutral", "informal", "slang"]);

export const wordCardSchema = z.object({
  headword: z.string().min(1),
  literal: z.string().min(1),
  inContext: z.string().min(1),
  insteadOf: z.object({
    word: z.string().min(1),
    verdict: verdictSchema,
    reason: z.string().min(1),
  }),
  pronunciation: z.string().optional(),
  register: registerSchema.optional(),
  confidence: z.number().min(0).max(1),
});

export const interpretationSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  confidence: z.number().min(0).max(1),
  alternatives: z
    .array(z.object({ title: z.string().min(1), artist: z.string().min(1) }))
    .max(3),
  ambiguous: z.boolean(),
});

export const dossierSchema = z.object({
  commonUses: z.array(z.string().min(1)),
  collocations: z.array(z.string().min(1)),
  register: registerSchema,
  confusables: z.array(z.object({ word: z.string().min(1), why: z.string().min(1) })),
  falseFriends: z.array(z.object({ word: z.string().min(1), means: z.string().min(1) })),
  avoid: z.string().min(1),
});
