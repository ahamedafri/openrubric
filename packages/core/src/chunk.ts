import type { Transcript } from "./types.js";

export interface Chunk {
  /** Indices into the original transcript included in this window (context + subject turns), ascending. */
  refs: number[];
  /** Subset of refs, in order, that belong to the subject — what actually gets judged in this chunk. */
  subjectRefs: number[];
}

/**
 * Splits a transcript into windows small enough for one LLM call each,
 * grouped by subject-turn count (chunkTurns) rather than total turn
 * count, since the subject's turns are what actually get judged. Each
 * window keeps a few turns of the other speaker's lines immediately
 * around it for context. A transcript with few subject turns is a
 * single chunk — most conversations never split at all.
 */
export function chunkTranscript(
  transcript: Transcript,
  subject: string,
  chunkTurns = 20,
  contextTurns = 2,
): Chunk[] {
  const subjectIndices = transcript.reduce<number[]>((acc, turn, i) => {
    if (turn.speaker === subject) acc.push(i);
    return acc;
  }, []);

  if (subjectIndices.length === 0) return [];
  if (subjectIndices.length <= chunkTurns) {
    return [{ refs: transcript.map((_, i) => i), subjectRefs: subjectIndices }];
  }

  const chunks: Chunk[] = [];
  for (let start = 0; start < subjectIndices.length; start += chunkTurns) {
    const subjectRefs = subjectIndices.slice(start, start + chunkTurns);
    const windowStart = Math.max(0, subjectRefs[0] - contextTurns);
    const windowEnd = Math.min(transcript.length - 1, subjectRefs[subjectRefs.length - 1] + contextTurns);
    const refs: number[] = [];
    for (let i = windowStart; i <= windowEnd; i++) refs.push(i);
    chunks.push({ refs, subjectRefs });
  }
  return chunks;
}
