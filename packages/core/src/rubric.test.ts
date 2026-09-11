import { describe, expect, it } from "vitest";
import { loadRubric, RubricValidationError } from "./rubric.js";

describe("loadRubric", () => {
  it("loads a plain object and normalizes snake_case wire keys", () => {
    const rubric = loadRubric({
      id: "toy",
      version: 1,
      criteria: [{ id: "clarity", label: "Clarity", guidance: "Be clear.", severity_hints: { high: "very unclear" } }],
      phrase_bank: { clarity: ["say it plainly"] },
      length: { min_subject_turns: 1, long_transcript_strategy: "truncate", chunk_turns: 10 },
    });
    expect(rubric.criteria[0].severityHints?.high).toBe("very unclear");
    expect(rubric.phraseBank?.clarity).toEqual(["say it plainly"]);
    expect(rubric.length?.longTranscriptStrategy).toBe("truncate");
  });

  it("loads a YAML string", () => {
    const yaml = `
id: toy
version: 1
criteria:
  - id: clarity
    label: Clarity
    guidance: Be clear.
`;
    const rubric = loadRubric(yaml);
    expect(rubric.id).toBe("toy");
    expect(rubric.criteria).toHaveLength(1);
  });

  it("throws RubricValidationError with no criteria", () => {
    expect(() => loadRubric({ id: "toy", version: 1, criteria: [] })).toThrow(RubricValidationError);
  });

  it("throws RubricValidationError when a criterion is missing required fields", () => {
    expect(() =>
      loadRubric({ id: "toy", version: 1, criteria: [{ id: "clarity" }] }),
    ).toThrow(RubricValidationError);
  });
});
