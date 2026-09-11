import { describe, expect, it } from "vitest";
import { chunkTranscript } from "./chunk.js";
import type { Transcript } from "./types.js";

function makeTranscript(subjectTurns: number): Transcript {
  const t: Transcript = [];
  for (let i = 0; i < subjectTurns; i++) {
    t.push({ speaker: "Interviewer", text: `Question ${i}` });
    t.push({ speaker: "Me", text: `Answer ${i}` });
  }
  return t;
}

describe("chunkTranscript", () => {
  it("returns one chunk covering everything when under the limit", () => {
    const transcript = makeTranscript(5);
    const chunks = chunkTranscript(transcript, "Me", 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].refs).toHaveLength(transcript.length);
    expect(chunks[0].subjectRefs).toHaveLength(5);
  });

  it("splits into multiple chunks once subject turns exceed chunkTurns", () => {
    const transcript = makeTranscript(25);
    const chunks = chunkTranscript(transcript, "Me", 10);
    expect(chunks.length).toBe(3);
    const totalSubjectRefs = chunks.flatMap((c) => c.subjectRefs);
    expect(totalSubjectRefs).toHaveLength(25);
    // every subject turn appears in exactly one chunk, in order
    expect(totalSubjectRefs).toEqual([...totalSubjectRefs].sort((a, b) => a - b));
  });

  it("includes a little context around each chunk's window", () => {
    const transcript = makeTranscript(25);
    const chunks = chunkTranscript(transcript, "Me", 10, 2);
    // second chunk's window should start before its first subject turn
    expect(chunks[1].refs[0]).toBeLessThan(chunks[1].subjectRefs[0]);
  });

  it("returns no chunks when the subject never speaks", () => {
    const transcript = makeTranscript(3);
    expect(chunkTranscript(transcript, "Nobody", 10)).toEqual([]);
  });
});
