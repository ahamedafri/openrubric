import { describe, expect, it, vi } from "vitest";
import { reviewTranscript } from "./review.js";
import type { ChatClient, Rubric, Transcript } from "./types.js";

const rubric: Rubric = {
  id: "job-interview-toy",
  version: 1,
  criteria: [
    { id: "specificity", label: "Concrete detail", guidance: "Flag vague answers." },
    { id: "hedging", label: "Hedging", guidance: "Flag hedging." },
  ],
  length: { chunkTurns: 2 },
};

const transcript: Transcript = [
  { speaker: "Interviewer", text: "Tell me about a hard bug you fixed." },
  { speaker: "Me", text: "I think maybe it sort of helped with the deploy issue." },
  { speaker: "Interviewer", text: "What was the impact?" },
  { speaker: "Me", text: "It cut p99 latency from 800ms to 210ms." },
];

/** Returns queued responses in order, one per call.complete(); records every call. */
class QueueClient implements ChatClient {
  calls: Array<{ prompt: string; temperature?: number }> = [];
  constructor(private responses: string[]) {}
  async complete(params: { prompt: string; temperature?: number }): Promise<string> {
    this.calls.push(params);
    const next = this.responses.shift();
    if (next === undefined) throw new Error("QueueClient ran out of queued responses");
    return next;
  }
}

describe("reviewTranscript", () => {
  it("falls back to the heuristic when no client is given, without throwing", async () => {
    const result = await reviewTranscript({ transcript, subject: "Me", rubric });
    expect(result.meta.usedFallback).toBe(true);
  });

  it("runs a real review with a mocked client, zipping findings back to the right turns", async () => {
    const chunkResponse = JSON.stringify({
      turns: [
        {
          turnNumber: 1,
          findings: [
            { criterion: "hedging", severity: "medium", note: "Hedged with 'I think maybe... sort of'." },
            // unknown criterion id — must be dropped, not surfaced
            { criterion: "not-a-real-criterion", severity: "high", note: "should be dropped" },
          ],
        },
        { turnNumber: 2, findings: [] },
      ],
      moments: [{ turnNumber: 1, criterion: "specificity", missing: "no concrete example", phrase: "name the exact fix" }],
    });
    const overallResponse = JSON.stringify({
      review: "Strong second answer, but the first leaned on hedging instead of a concrete claim.",
      scores: { specificity: 0.6, hedging: 0.4 },
    });
    const client = new QueueClient([chunkResponse, overallResponse]);

    const result = await reviewTranscript({ transcript, subject: "Me", rubric, client });

    expect(result.meta.usedFallback).toBe(false);
    expect(result.meta.subjectTurns).toBe(2);
    expect(result.turns.map((t) => t.ref)).toEqual([1, 3]);

    const firstTurn = result.turns.find((t) => t.ref === 1);
    expect(firstTurn?.findings).toHaveLength(1);
    expect(firstTurn?.findings[0].criterion).toBe("hedging");

    expect(result.moments).toHaveLength(1);
    expect(result.moments[0].ref).toBe(1); // mapped from turnNumber 1 -> transcript index 1

    expect(result.scores).toEqual({ specificity: 0.6, hedging: 0.4 });
    expect(result.review).toContain("hedging");
  });

  it("splits into multiple chunks and makes one extra call for the overall pass", async () => {
    const bigTranscript: Transcript = [];
    for (let i = 0; i < 5; i++) {
      bigTranscript.push({ speaker: "Interviewer", text: `Q${i}` });
      bigTranscript.push({ speaker: "Me", text: `A${i}` });
    }
    const chunkResponse = JSON.stringify({ turns: [], moments: [] });
    const overallResponse = JSON.stringify({ review: "ok", scores: { specificity: 1, hedging: 1 } });
    // chunkTurns: 2 over 5 subject turns -> 3 chunks + 1 overall call = 4
    const client = new QueueClient([chunkResponse, chunkResponse, chunkResponse, overallResponse]);
    const complete = vi.spyOn(client, "complete");

    const result = await reviewTranscript({ transcript: bigTranscript, subject: "Me", rubric, client });

    expect(complete).toHaveBeenCalledTimes(4);
    expect(result.meta.chunks).toBe(3);
    expect(result.meta.subjectTurns).toBe(5);
  });

  it("degrades to the heuristic if the model returns unparsable output", async () => {
    const client = new QueueClient(["not json at all"]);
    const result = await reviewTranscript({ transcript, subject: "Me", rubric, client });
    expect(result.meta.usedFallback).toBe(true);
  });

  it("degrades to the heuristic if the client throws", async () => {
    const client: ChatClient = {
      complete: async () => {
        throw new Error("network error");
      },
    };
    const result = await reviewTranscript({ transcript, subject: "Me", rubric, client });
    expect(result.meta.usedFallback).toBe(true);
  });
});
