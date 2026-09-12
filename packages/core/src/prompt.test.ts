import { describe, expect, it } from "vitest";
import { buildChunkPrompt, buildOverallPrompt } from "./prompt.js";
import type { Rubric, Transcript } from "./types.js";

const transcript: Transcript = [
  { speaker: "Interviewer", text: "Go on." },
  { speaker: "Me", text: "Sure." },
];

describe("buildChunkPrompt", () => {
  it("includes the rubric's phraseBank when present, grouped by criterion", () => {
    const rubric: Rubric = {
      id: "toy",
      version: 1,
      criteria: [{ id: "structure", label: "Structure", guidance: "Use STAR." }],
      phraseBank: { structure: ["The situation was ___.", "As a result, ___."] },
    };
    const prompt = buildChunkPrompt({ rubric, transcript, refs: [0, 1], subjectRefs: [1], subject: "Me" });
    expect(prompt).toContain("Suggested phrases");
    expect(prompt).toContain("structure:");
    expect(prompt).toContain("The situation was ___.");
    expect(prompt).toContain("As a result, ___.");
  });

  it("omits the phrase-bank section entirely when the rubric has none", () => {
    const rubric: Rubric = {
      id: "toy",
      version: 1,
      criteria: [{ id: "structure", label: "Structure", guidance: "Use STAR." }],
    };
    const prompt = buildChunkPrompt({ rubric, transcript, refs: [0, 1], subjectRefs: [1], subject: "Me" });
    expect(prompt).not.toContain("Suggested phrases");
  });
});

describe("buildOverallPrompt", () => {
  const rubric: Rubric = {
    id: "toy",
    version: 1,
    criteria: [{ id: "structure", label: "Structure", guidance: "Use STAR." }],
  };

  it("instructs the model not to default to generic critique when findings are sparse", () => {
    const prompt = buildOverallPrompt({ rubric, subject: "Me", findingsSummary: "", cleanCriteria: ["structure"] });
    expect(prompt).toContain("(no findings were raised against any turn)");
    expect(prompt.toLowerCase()).toContain("generic");
  });

  it("states clean criteria as a given fact rather than leaving it to be inferred", () => {
    const prompt = buildOverallPrompt({ rubric, subject: "Me", findingsSummary: "", cleanCriteria: ["structure"] });
    expect(prompt).toContain("ZERO findings anywhere in this conversation: structure");
    expect(prompt).toContain("not an inference you need to draw");
  });

  it("says 'none' when nothing is clean", () => {
    const prompt = buildOverallPrompt({ rubric, subject: "Me", findingsSummary: "turn 1: structure (low) - x", cleanCriteria: [] });
    expect(prompt).toContain("ZERO findings anywhere in this conversation: none");
  });
});
