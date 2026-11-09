/**
 * The difficult resolution cases from the PRD's evidence table (E14), run
 * against the real lyrics source.
 *
 * These hit the network, so they only run with RUN_LIVE=1:
 *   RUN_LIVE=1 bunx vitest run src/test/resolve-live.test.ts
 *
 * The default suite stays offline and deterministic; this file is the
 * reproducible check that the pipeline still resolves the cases it was
 * designed against.
 */

import { describe, expect, it } from "vitest";

import { decideSearch } from "@/lib/songs/decision";
import { resolveCandidates } from "@/lib/lyrics/vagalume.server";

const RUN = process.env["RUN_LIVE"] === "1";
const TIMEOUT = 60_000;

type Case = {
  name: string;
  artist: string;
  title: string;
  /** Expected canonical path fragment on the source. */
  expectPath: string;
  /** Minimum score the right answer must reach. */
  minScore: number;
};

const CASES: Case[] = [
  {
    name: "typo no título e no artista",
    artist: "quen",
    title: "bohemian rapsody",
    expectPath: "/queen/bohemian-rhapsody.html",
    minScore: 0.85,
  },
  {
    name: "título comum de artista famoso",
    artist: "beatles",
    title: "let it be",
    expectPath: "/the-beatles/let-it-be.html",
    minScore: 0.85,
  },
  {
    name: "plural errado na fonte",
    artist: "garth brooks",
    title: "the thunder roll",
    expectPath: "/garth-brooks/the-thunder-rolls.html",
    minScore: 0.85,
  },
  {
    name: "artista com acento",
    artist: "legião urbana",
    title: "tempo perdido",
    expectPath: "/legiao-urbana/tempo-perdido.html",
    minScore: 0.85,
  },
  {
    name: "artista sem acento",
    artist: "legiao urbana",
    title: "tempo perdido",
    expectPath: "/legiao-urbana/tempo-perdido.html",
    minScore: 0.85,
  },
];

describe.runIf(RUN)("resolução ao vivo (E14)", () => {
  for (const c of CASES) {
    it(
      `${c.name}: ${c.artist} / ${c.title}`,
      async () => {
        const rows = await resolveCandidates(c.artist, c.title);
        const hit = rows.find((row) => row.url.endsWith(c.expectPath));
        expect(hit, `esperava ${c.expectPath} em ${JSON.stringify(rows.slice(0, 3))}`).toBeDefined();
        expect(hit!.score).toBeGreaterThanOrEqual(c.minScore);
      },
      TIMEOUT,
    );
  }

  it(
    "palavra inventada não entrega letra errada",
    async () => {
      const rows = await resolveCandidates("xzqwv", "blorfmatic shundrel");
      const decision = decideSearch(rows);
      expect(decision.kind).toBe("none");
    },
    TIMEOUT,
  );

  it(
    "caso duvidoso (I'm Flying / Jimmy Clay) nunca é auto-aceito",
    async () => {
      const rows = await resolveCandidates("jimmy clay", "i'm flying");
      const decision = decideSearch(rows);
      // E14 registrou r=0.56 com o artista errado: a barra de D4 existe para
      // que esse caso peça confirmação em vez de ensinar a música errada.
      expect(decision.kind).not.toBe("auto");
    },
    TIMEOUT,
  );
});
