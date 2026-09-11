import { describe, expect, it } from "vitest";
import { reviewHeuristically } from "./heuristic.js";
import type { Rubric, Transcript } from "./types.js";

const rubric: Rubric = {
  id: "toy",
  version: 1,
  criteria: [
    { id: "hedging", label: "Hedging and confidence", guidance: "Flag hedging." },
    { id: "specificity", label: "Concrete detail", guidance: "Flag vague answers." },
  ],
};

const transcript: Transcript = [
  { speaker: "Interviewer", text: "Tell me about a hard bug." },
  { speaker: "Me", text: "I think maybe it sort of helped, probably, I guess." },
  { speaker: "Interviewer", text: "Anything else?" },
  { speaker: "Me", text: "No." },
];

describe("reviewHeuristically", () => {
  it("always marks usedFallback and never throws without a client", () => {
    const result = reviewHeuristically({ transcript, subject: "Me", rubric });
    expect(result.meta.usedFallback).toBe(true);
    expect(result.meta.subjectTurns).toBe(2);
  });

  it("flags heavy hedging against a criterion matched by keyword", () => {
    const result = reviewHeuristically({ transcript, subject: "Me", rubric });
    const hedgeTurn = result.turns.find((t) => t.ref === 1);
    expect(hedgeTurn?.findings.some((f) => f.criterion === "hedging")).toBe(true);
  });

  it("flags a very short answer against a criterion matched by keyword", () => {
    const result = reviewHeuristically({ transcript, subject: "Me", rubric });
    const shortTurn = result.turns.find((t) => t.ref === 3);
    expect(shortTurn?.findings.some((f) => f.criterion === "specificity")).toBe(true);
  });

  it("returns a score for every criterion even though it can't judge them precisely", () => {
    const result = reviewHeuristically({ transcript, subject: "Me", rubric });
    expect(Object.keys(result.scores).sort()).toEqual(["hedging", "specificity"]);
  });
});
