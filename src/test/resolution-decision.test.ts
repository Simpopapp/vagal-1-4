import { describe, expect, it } from "vitest";

import {
  AUTO_ACCEPT_SCORE,
  CHOOSE_MIN_SCORE,
  MAX_CHOICES,
  decideSearch,
} from "@/lib/songs/decision";
import type { Candidate } from "@/lib/types";

function candidate(score: number, url = `/a/${score}.html`): Candidate {
  return { artist: "A", title: "T", url, score, reason: "teste" };
}

describe("decideSearch (PRD D4)", () => {
  it("auto-aceita quando o melhor score é >= 0.85", () => {
    const decision = decideSearch([candidate(0.9), candidate(0.7)]);
    expect(decision.kind).toBe("auto");
    if (decision.kind === "auto") expect(decision.candidate.score).toBe(0.9);
  });

  it("aceita exatamente no limiar 0.85", () => {
    expect(decideSearch([candidate(AUTO_ACCEPT_SCORE)]).kind).toBe("auto");
  });

  it("mostra 'era essa?' entre 0.55 e 0.85, sem chutar", () => {
    const decision = decideSearch([candidate(0.7), candidate(0.6), candidate(0.3)]);
    expect(decision.kind).toBe("choose");
    if (decision.kind === "choose") {
      expect(decision.candidates.map((c) => c.score)).toEqual([0.7, 0.6]);
    }
  });

  it("limita as opções a 3 cards", () => {
    const decision = decideSearch([
      candidate(0.8),
      candidate(0.75),
      candidate(0.7),
      candidate(0.65),
      candidate(0.6),
    ]);
    expect(decision.kind).toBe("choose");
    if (decision.kind === "choose") expect(decision.candidates).toHaveLength(MAX_CHOICES);
  });

  it("pede mais informação abaixo de 0.55, mesmo com candidatos", () => {
    expect(decideSearch([candidate(0.54), candidate(0.3)]).kind).toBe("none");
  });

  it("pede mais informação sem candidatos", () => {
    expect(decideSearch([]).kind).toBe("none");
  });

  it("rejeita exatamente abaixo do limiar de escolha", () => {
    expect(decideSearch([candidate(CHOOSE_MIN_SCORE - 0.001)]).kind).toBe("none");
    expect(decideSearch([candidate(CHOOSE_MIN_SCORE)]).kind).toBe("choose");
  });

  it("ordena pelo score antes de decidir", () => {
    const decision = decideSearch([candidate(0.6), candidate(0.9)]);
    expect(decision.kind).toBe("auto");
  });
});
