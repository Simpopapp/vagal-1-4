/**
 * The lemma is the key of the vocabulary (PRD D7), so every fold here is a
 * promise about which words study together. The rule that decides them is the
 * same one the planning states: fold only what is certain, because a wrong
 * lemma merges two different words — worse than a missed one.
 *
 * The doubled-letter cases are not hypothetical: `rolling` reached the
 * vocabulary as `rol`, which is a different word than the one the learner
 * tapped in the lyrics.
 */

import { describe, expect, it } from "vitest";

import { lemma, sameWord } from "@/lib/words/lemma";

describe("doubled letters that belong to the base", () => {
  it("keeps the double when the base really ends in it", () => {
    expect(lemma("rolling")).toBe("roll");
    expect(lemma("calling")).toBe("call");
    expect(lemma("called")).toBe("call");
    expect(lemma("falling")).toBe("fall");
    expect(lemma("telling")).toBe("tell");
    expect(lemma("killing")).toBe("kill");
    expect(lemma("pulling")).toBe("pull");
    expect(lemma("willing")).toBe("will");
  });

  it("keeps the double for -ss, -zz, -ff and -dd bases", () => {
    expect(lemma("kissing")).toBe("kiss");
    expect(lemma("kissed")).toBe("kiss");
    expect(lemma("missed")).toBe("miss");
    expect(lemma("passing")).toBe("pass");
    expect(lemma("dressing")).toBe("dress");
    expect(lemma("buzzing")).toBe("buzz");
    expect(lemma("stuffing")).toBe("stuff");
    expect(lemma("adding")).toBe("add");
  });

  it("leaves a comparative whose base ends doubled whole rather than inventing a word", () => {
    expect(lemma("taller")).toBe("taller");
    expect(lemma("tallest")).toBe("tallest");
    expect(lemma("smallest")).toBe("smallest");
    expect(lemma("dullest")).toBe("dullest");
  });
});

describe("doubling the ending itself created", () => {
  it("undoes it so the base comes back", () => {
    expect(lemma("running")).toBe("run");
    expect(lemma("stopped")).toBe("stop");
    expect(lemma("stopping")).toBe("stop");
    expect(lemma("sitting")).toBe("sit");
    expect(lemma("getting")).toBe("get");
    expect(lemma("beginning")).toBe("begin");
    expect(lemma("planning")).toBe("plan");
    expect(lemma("swimming")).toBe("swim");
    expect(lemma("occurring")).toBe("occur");
    expect(lemma("biggest")).toBe("big");
  });
});

describe("silent -e in the base", () => {
  it("puts the -e back where the base carries one", () => {
    expect(lemma("dancing")).toBe("dance");
    expect(lemma("danced")).toBe("dance");
    expect(lemma("making")).toBe("make");
    expect(lemma("taking")).toBe("take");
    expect(lemma("writing")).toBe("write");
    expect(lemma("riding")).toBe("ride");
    expect(lemma("loving")).toBe("love");
    expect(lemma("lived")).toBe("live");
    expect(lemma("rising")).toBe("rise");
    expect(lemma("promising")).toBe("promise");
    expect(lemma("carving")).toBe("carve");
    expect(lemma("served")).toBe("serve");
    expect(lemma("movies")).toBe("movie");
  });

  it("restores it for comparatives without pulling nouns along", () => {
    expect(lemma("braver")).toBe("brave");
    expect(lemma("wiser")).toBe("wise");
    expect(lemma("nicer")).toBe("nice");
    expect(lemma("purer")).toBe("pure");
    expect(lemma("writer")).toBe("write");
  });

  it("does not invent an -e where the base has none", () => {
    expect(lemma("shooting")).toBe("shoot");
    expect(lemma("pouring")).toBe("pour");
    expect(lemma("touring")).toBe("tour");
    expect(lemma("quicking")).toBe("quick");
    expect(lemma("smacking")).toBe("smack");
  });
});

describe("words the rules must not touch", () => {
  it("leaves nouns that only look like comparatives alone", () => {
    expect(lemma("river")).toBe("river");
    expect(lemma("liver")).toBe("liver");
    expect(lemma("lover")).toBe("lover");
    expect(lemma("cover")).toBe("cover");
    expect(lemma("power")).toBe("power");
    expect(lemma("wonder")).toBe("wonder");
    expect(lemma("thunder")).toBe("thunder");
    expect(lemma("summer")).toBe("summer");
    expect(lemma("bitter")).toBe("bitter");
    expect(lemma("mother")).toBe("mother");
    expect(lemma("weather")).toBe("weather");
  });

  it("returns the plain form when no rule is sure", () => {
    expect(lemma("cold")).toBe("cold");
    expect(lemma("happy")).toBe("happy");
    expect(lemma("see")).toBe("see");
    expect(lemma("this")).toBe("this");
    expect(lemma("yes")).toBe("yes");
    expect(lemma("")).toBe("");
  });
});

describe("irregular forms", () => {
  it("maps the past and progressive forms a rule cannot derive", () => {
    expect(lemma("said")).toBe("say");
    expect(lemma("told")).toBe("tell");
    expect(lemma("thought")).toBe("think");
    expect(lemma("ran")).toBe("run");
    expect(lemma("sang")).toBe("sing");
    expect(lemma("woke")).toBe("wake");
    expect(lemma("hid")).toBe("hide");
    expect(lemma("dying")).toBe("die");
    expect(lemma("used")).toBe("use");
    expect(lemma("using")).toBe("use");
    expect(lemma("going")).toBe("go");
    expect(lemma("seeing")).toBe("see");
  });
});

describe("sameWord", () => {
  it("joins every form of one word into one vocabulary entry", () => {
    expect(sameWord("rolling", "roll")).toBe(true);
    expect(sameWord("rolled", "rolls")).toBe(true);
    expect(sameWord("flying", "flew")).toBe(true);
    expect(sameWord("dancing", "danced")).toBe(true);
    expect(sameWord("kissing", "kissed")).toBe(true);
  });

  it("keeps different words apart", () => {
    expect(sameWord("roll", "call")).toBe(false);
    expect(sameWord("kiss", "miss")).toBe(false);
    expect(sameWord("love", "lover")).toBe(false);
    expect(sameWord("river", "live")).toBe(false);
  });
});

describe("other languages", () => {
  it("passes the surface form through untouched", () => {
    expect(lemma("Rolling", "pt")).toBe("rolling");
    expect(lemma("coração", "pt")).toBe("coração");
  });
});
