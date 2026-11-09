/**
 * The lyrics source is the only thing the app shows as a lyric (PRD D2), so
 * the two functions that decide "what is the lyric" and "how close is this
 * match" are tested against the markup and the misses that actually happen.
 */

import { describe, expect, it } from "vitest";

import { extractLyrics, similarity } from "@/lib/lyrics/vagalume.server";

describe("extractLyrics", () => {
  it("keeps the lyric text exactly as published, with stanza breaks", () => {
    const html = `
      <html><body>
        <div id="lyrics" data-plugin="googleTranslate">
          Is this the real life?<br>
          Is this just fantasy?<br><br>
          Caught in a landslide,<br>
          No escape from reality.
        </div>
      </body></html>`;

    expect(extractLyrics(html)).toBe(
      "Is this the real life?\nIs this just fantasy?\n\nCaught in a landslide,\nNo escape from reality.",
    );
  });

  it("finds the block even when the div carries extra attributes", () => {
    const html = `<div class="lyrics" id="lyrics" itemscope="itemscope">${"line one"}</div>`;
    expect(extractLyrics(html)).toBe("line one");
  });

  it("returns null when the page has no lyric block", () => {
    const html = `<html><body><div id="content">nada</div></body></html>`;
    expect(extractLyrics(html)).toBeNull();
  });

  it("returns null instead of an empty lyric", () => {
    const html = `<div id="lyrics">   <br>  </div>`;
    expect(extractLyrics(html)).toBeNull();
  });

  it("decodes the entities the source actually uses", () => {
    const html = `<div id="lyrics">Don&#39;t stop me now &amp; on<br>&nbsp;again</div>`;
    expect(extractLyrics(html)).toBe("Don't stop me now & on\n again");
  });

  it("never invents a lyric when the block is missing, even if text exists", () => {
    const html = `<div id="other">Some unrelated page text</div>`;
    expect(extractLyrics(html)).toBeNull();
  });
});

describe("similarity", () => {
  it("scores an exact title match at 1", () => {
    expect(similarity("bohemian rhapsody", "bohemian rhapsody")).toBe(1);
  });

  it("ignores accents and punctuation when comparing", () => {
    expect(similarity("Legião Urbana", "legiao urbana")).toBe(1);
  });

  it("puts the real title well above an unrelated one", () => {
    const real = similarity("bohemian rhapsody", "Bohemian Rhapsody");
    const wrong = similarity("bohemian rhapsody", "Under Pressure");
    expect(real).toBeGreaterThan(0.85);
    expect(wrong).toBeLessThan(0.5);
  });

  it("keeps a weak match below the auto-accept line", () => {
    // The case that showed up in testing: a wrong candidate scored 0.56.
    expect(similarity("i'm flying", "flying")).toBeLessThan(0.85);
  });

  it("scores identical text at 1 and unrelated short text at 0", () => {
    expect(similarity("a", "a")).toBe(1);
    expect(similarity("a", "b")).toBe(0);
    expect(similarity("", "")).toBe(0);
  });
});
