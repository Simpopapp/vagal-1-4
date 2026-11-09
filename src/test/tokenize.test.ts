/**
 * The tokenizer decides what a "word" is when the user taps a lyric (F2), so
 * every case here is a shape that appears in real song lines: contractions,
 * hyphenated compounds, credit markers, accents, and lines that are not words
 * at all.
 */

import { describe, expect, it } from "vitest";

import { isWordToken, tokenize, wordsOf } from "@/lib/words/tokenize";

const CASES: [string, string[]][] = [
  ["Is this the real life?", ["Is", "this", "the", "real", "life"]],
  ["Is this just fantasy?", ["Is", "this", "just", "fantasy"]],
  ["Don't stop me now", ["Don't", "stop", "me", "now"]],
  ["I'm just a poor boy", ["I'm", "just", "a", "poor", "boy"]],
  ["Well-known legend", ["Well-known", "legend"]],
  ["sha-la-la", ["sha-la-la"]],
  ["rock-n-roll", ["rock-n-roll"]],
  ["o'clock", ["o'clock"]],
  ["'cause", ["cause"]],
  ["A Hard Day's Night", ["A", "Hard", "Day's", "Night"]],
  ["Baby, I'm Yours", ["Baby", "I'm", "Yours"]],
  ["It's Raining Men", ["It's", "Raining", "Men"]],
  ["We Are the Champions", ["We", "Are", "the", "Champions"]],
  ["Papa Don't Preach", ["Papa", "Don't", "Preach"]],
  ["Bohemian Rhapsody", ["Bohemian", "Rhapsody"]],
  ["Smells Like Teen Spirit", ["Smells", "Like", "Teen", "Spirit"]],
  ["É o fim", ["É", "o", "fim"]],
  ["Legião Urbana", ["Legião", "Urbana"]],
  ["Respect", ["Respect"]],
  ["Hallelujah", ["Hallelujah"]],
  ["Billie Jean", ["Billie", "Jean"]],
  ["Jude", ["Jude"]],
  ["1999", []],
  ["...", []],
  ["", []],
];

describe("wordsOf", () => {
  for (const [line, expected] of CASES) {
    it(`marks "${line || "(empty line)"}" as ${expected.length} word(s)`, () => {
      expect(wordsOf(line)).toEqual(expected);
    });
  }
});

describe("tokenize", () => {
  it("never loses a character: the tokens concatenate back to the line", () => {
    for (const [line] of CASES) {
      expect(tokenize(line).join("")).toBe(line);
    }
  });

  it("keeps the credit marker out of the words but inside the line", () => {
    const line = "Under Pressure (feat. David Bowie)";
    expect(tokenize(line).join("")).toBe(line);
    expect(wordsOf(line)).toEqual(["Under", "Pressure", "David", "Bowie"]);
    expect(isWordToken("feat.")).toBe(false);
  });

  it("separates punctuation so the lyric text is unchanged", () => {
    expect(tokenize("landslide,")).toEqual(["landslide", ","]);
    expect(tokenize("  ")).toEqual(["  "]);
  });
});
