import { describe, expect, it } from "vitest";

import { availableKinds, buildSession, gradeVerdictChoice } from "@/lib/srs/session";
import type { Card, Dossier, Review, Sense, Word } from "@/lib/types";

function word(id: string, headword = id): Word {
  return {
    id,
    headword,
    surfaceForm: headword,
    language: "en",
    level: "b1",
    stage: "new",
    status: "active",
    favorite: false,
    firstSeenAt: 1,
    lastSeenAt: 1,
  };
}

function cardFor(w: Word): Card {
  return {
    wordId: w.id,
    headword: w.headword,
    generatedAt: 1,
    card: {
      headword: w.headword,
      literal: "literal",
      inContext: "na frase",
      insteadOf: { word: "other", verdict: "mcnc", reason: "motivo" },
      confidence: 0.9,
    },
  };
}

function sense(w: Word, songId: string, line = `line with ${w.headword}`): Sense {
  return {
    id: `${w.id}-${songId}`,
    wordId: w.id,
    songId,
    headword: w.headword,
    surfaceForm: w.surfaceForm,
    line,
    stanzaIndex: 0,
    lineIndex: 0,
    createdAt: 1,
  };
}

function review(w: Word, over: Partial<Review> = {}): Review {
  return {
    id: `r-${w.id}-${Math.random()}`,
    wordId: w.id,
    kind: "context-meaning",
    correct: true,
    reviewedAt: 100,
    dueAt: 100,
    lapseCount: 0,
    ...over,
  };
}

const NOW = 10_000;

describe("practice session (F6)", () => {
  it("palavra com card oferece os três ângulos de card", () => {
    const w = word("a");
    const kinds = availableKinds("a", {
      cards: new Map([["a", cardFor(w)]]),
      sensesByWord: new Map([["a", [sense(w, "s1")]]]),
      dossiers: new Map(),
    });
    expect(kinds).toContain("context-meaning");
    expect(kinds).toContain("synonym-fits");
    expect(kinds).toContain("lyrics-gap");
    expect(kinds).not.toContain("reappearance");
  });

  it("reaparição só existe quando a palavra está em 2+ músicas", () => {
    const w = word("b");
    const oneSong = availableKinds("b", {
      cards: new Map(),
      sensesByWord: new Map([["b", [sense(w, "s1")]]]),
      dossiers: new Map(),
    });
    const twoSongs = availableKinds("b", {
      cards: new Map(),
      sensesByWord: new Map([["b", [sense(w, "s1"), sense(w, "s2", "another line")]]]),
      dossiers: new Map(),
    });
    expect(oneSong).not.toContain("reappearance");
    expect(twoSongs).toContain("reappearance");
  });

  it("palavra vencida entra na sessão; palavra não vencida não entra", () => {
    const due = word("due");
    const later = word("later");
    const items = buildSession({
      words: [due, later],
      cards: new Map([
        ["due", cardFor(due)],
        ["later", cardFor(later)],
      ]),
      sensesByWord: new Map([
        ["due", [sense(due, "s1")]],
        ["later", [sense(later, "s1")]],
      ]),
      reviewsByWord: new Map([
        ["due", [review(due, { dueAt: NOW - 1 })]],
        ["later", [review(later, { dueAt: NOW + 999_999 })]],
      ]),
      dossiers: new Map(),
      now: NOW,
    });
    expect(items.map((i) => i.wordId)).toEqual(["due"]);
  });

  it("nunca repete o mesmo ângulo da última revisão", () => {
    const w = word("rot");
    const items = buildSession({
      words: [w],
      cards: new Map([["rot", cardFor(w)]]),
      sensesByWord: new Map([["rot", [sense(w, "s1")]]]),
      reviewsByWord: new Map([["rot", [review(w, { kind: "context-meaning", dueAt: NOW - 1 })]]]),
      dossiers: new Map(),
      now: NOW,
    });
    expect(items[0]?.kind).not.toBe("context-meaning");
  });

  it("synonym-fits é corrigido pelo veredito, não por autoavaliação", () => {
    expect(gradeVerdictChoice("mcnc", "mcnc")).toBe(true);
    expect(gradeVerdictChoice("right", "mcnc")).toBe(false);
    expect(gradeVerdictChoice("wrong", "wrong")).toBe(true);
  });

  it("confusable-choice exige dossiê com confundíveis", () => {
    const w = word("c");
    const dossier: Dossier = {
      wordId: "c",
      headword: "c",
      commonUses: [],
      collocations: [],
      register: "neutral",
      confusables: [{ word: "sea", why: "soam parecidas" }],
      falseFriends: [],
      avoid: "nada",
      generatedAt: 1,
    };
    const kinds = availableKinds("c", {
      cards: new Map(),
      sensesByWord: new Map([["c", [sense(w, "s1")]]]),
      dossiers: new Map([["c", dossier]]),
    });
    expect(kinds).toContain("confusable-choice");
  });

  it("palavra sem card e sem dossiê não vira item", () => {
    const w = word("bare");
    const items = buildSession({
      words: [w],
      cards: new Map(),
      sensesByWord: new Map([["bare", [sense(w, "s1")]]]),
      reviewsByWord: new Map(),
      dossiers: new Map(),
      now: NOW,
    });
    expect(items).toEqual([]);
  });
});
