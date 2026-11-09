/**
 * Line tokenizer for the reading screen (F2).
 *
 * The rules come from what lyrics actually contain: contractions keep their
 * apostrophe (`don't`, `i'm`, `o'clock`), compounds keep their hyphen
 * (`well-known`, `sha-la-la`), and a credit marker (`feat.`) is not a word a
 * learner should be asked to study.
 *
 * Joining the tokens back must reproduce the line exactly — the reader renders
 * every token, so a dropped character would silently change the lyric.
 */

const CREDIT_MARKERS = new Set(["feat.", "ft.", "featuring", "vs.", "vs"]);

/**
 * Alternation order matters: the credit marker is tried before the word so
 * `feat.` is never split into `feat` + `.`, and the word branch requires the
 * token to end on a letter so trailing punctuation stays its own token.
 */
const TOKEN = new RegExp(
  [
    String.raw`(?:feat\.|ft\.|featuring|vs\.)`,
    String.raw`(?:\p{L}[\p{L}\p{N}'’-]*\p{L})`,
    String.raw`(?:\p{L})`,
    String.raw`(?:[^\s\p{L}]+)`,
    String.raw`(?:\s+)`,
  ].join("|"),
  "giu",
);

const WORD_SHAPE = /^\p{L}(?:[\p{L}\p{N}'’-]*\p{L})?$/u;

/** Splits a lyric line into tokens whose concatenation is the original line. */
export function tokenize(line: string): string[] {
  return line.match(TOKEN) ?? [];
}

/** True when a token is a word the user may mark. */
export function isWordToken(token: string): boolean {
  if (CREDIT_MARKERS.has(token.toLowerCase())) return false;
  return WORD_SHAPE.test(token);
}

/** Only the markable words of a line, in order. */
export function wordsOf(line: string): string[] {
  return tokenize(line).filter(isWordToken);
}
