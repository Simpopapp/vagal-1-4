/**
 * The scheduler decides when a word returns and from which angle, so each rule
 * here is one behaviour the planning promises the learner: a miss brings the
 * word back sooner, a hit pushes it out, and a word is not asked the same way
 * twice in a row.
 */

import { describe, expect, it } from "vitest";

import {
  DAYS,
  FIRST_GAP,
  MAX_GAP,
  MINUTES,
  WRONG_GAP,
  nextGapMs,
  nextLapseCount,
  pickNextKind,
  planReview,
} from "@/lib/srs/scheduler";
import type { ReviewKind } from "@/lib/types";

const NOW = 1_700_000_000_000;

describe("nextGapMs", () => {
  it("brings a never-reviewed word back in ten minutes after a hit", () => {
    expect(nextGapMs(0, true, 0)).toBe(FIRST_GAP);
    expect(FIRST_GAP).toBe(10 * MINUTES);
  });

  it("multiplies a clean streak", () => {
    expect(nextGapMs(10 * MINUTES, true, 0)).toBe(23 * MINUTES);
    expect(nextGapMs(23 * MINUTES, true, 0)).toBeCloseTo(52.9 * MINUTES, 0);
  });

  it("brings a miss back inside the same sitting", () => {
    expect(nextGapMs(9 * DAYS, false, 0)).toBe(WRONG_GAP);
  });

  it("trusts a recovered word less than a clean one", () => {
    expect(nextGapMs(10 * MINUTES, true, 2)).toBe(11.5 * MINUTES);
  });

  it("never schedules further out than a month", () => {
    expect(nextGapMs(20 * DAYS, true, 0)).toBe(MAX_GAP);
    expect(MAX_GAP).toBe(30 * DAYS);
  });
});

describe("nextLapseCount", () => {
  it("counts consecutive misses", () => {
    expect(nextLapseCount(false, 0)).toBe(1);
    expect(nextLapseCount(false, 1)).toBe(2);
  });

  it("clears the streak on a hit", () => {
    expect(nextLapseCount(true, 4)).toBe(0);
  });
});

describe("planReview", () => {
  it("sets the due time one gap ahead and clears the streak on a hit", () => {
    const plan = planReview({ previousGapMs: 10 * MINUTES, correct: true, lapseCount: 1, now: NOW });
    expect(plan.gapMs).toBe(11.5 * MINUTES);
    expect(plan.dueAt).toBe(NOW + 11.5 * MINUTES);
    expect(plan.lapseCount).toBe(0);
  });

  it("shortens the wait after a miss and records the lapse", () => {
    const plan = planReview({ previousGapMs: 5 * DAYS, correct: false, lapseCount: 0, now: NOW });
    expect(plan.gapMs).toBe(WRONG_GAP);
    expect(plan.dueAt).toBe(NOW + WRONG_GAP);
    expect(plan.lapseCount).toBe(1);
    expect(plan.dueAt).toBeLessThan(NOW + 5 * DAYS);
  });
});

describe("pickNextKind", () => {
  const KINDS: ReviewKind[] = [
    "context-meaning",
    "synonym-fits",
    "lyrics-gap",
    "confusable-choice",
    "reappearance",
  ];

  it("does not ask the same angle twice in a row", () => {
    const next = pickNextKind(KINDS, ["lyrics-gap"]);
    expect(next).not.toBe("lyrics-gap");
    expect(KINDS).toContain(next);
  });

  it("rotates through the angles as the word keeps coming back", () => {
    const seen: ReviewKind[] = [];
    let recent: ReviewKind[] = [];
    for (let i = 0; i < 4; i += 1) {
      const next = pickNextKind(KINDS, recent);
      expect(next).not.toBe(recent[recent.length - 1]);
      seen.push(next);
      recent = [...recent, next];
    }
    expect(new Set(seen).size).toBeGreaterThan(2);
  });

  it("still answers when only one angle exists", () => {
    expect(pickNextKind(["lyrics-gap"], ["lyrics-gap"])).toBe("lyrics-gap");
  });

  it("refuses to choose from nothing", () => {
    expect(() => pickNextKind([], [])).toThrow();
  });
});
