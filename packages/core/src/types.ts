/**
 * Shared shapes for the review engine. Unlike a fixed error taxonomy,
 * criterion ids are open — they come from whatever rubric the caller
 * loads (see rubric.ts) — so there is no global enum to keep in sync
 * here; validity is checked at review time against the loaded rubric.
 */

export type Severity = "low" | "medium" | "high";

export interface TranscriptTurn {
  speaker: string;
  text: string;
  /** Seconds from the start of the conversation, if known. */
  ts?: number;
}

export type Transcript = TranscriptTurn[];

export interface CriterionExamples {
  weak?: string;
  strong?: string;
}

export interface Criterion {
  id: string;
  label: string;
  /** What the model should look for and how to judge it. */
  guidance: string;
  severityHints?: Partial<Record<Severity, string>>;
  examples?: CriterionExamples;
}

export type LongTranscriptStrategy = "map-reduce" | "truncate" | "single-pass";

export interface Rubric {
  id: string;
  version: number;
  description?: string;
  /** BCP-47-ish tag, informational only — openrubric does no translation. */
  language?: string;
  criteria: Criterion[];
  /** Optional suggested phrasings per criterion id, drawn on when a finding needs a concrete alternative. */
  phraseBank?: Record<string, string[]>;
  length?: {
    minSubjectTurns?: number;
    longTranscriptStrategy?: LongTranscriptStrategy;
    /** Subject turns per chunk when longTranscriptStrategy is "map-reduce". */
    chunkTurns?: number;
  };
}

export interface TurnFinding {
  /** Must match a criterion id in the rubric that was passed in — findings citing an unknown id are dropped, not surfaced. */
  criterion: string;
  severity: Severity;
  /** The exact span of the turn's text the finding is about, if applicable. */
  quote?: string;
  note: string;
  suggestion?: string;
}

export interface ReviewedTurn {
  /** Index into the transcript array that was passed in. */
  ref: number;
  speaker: string;
  text: string;
  findings: TurnFinding[];
}

export interface Moment {
  ref: number;
  criterion: string;
  missing: string;
  phrase?: string;
}

export interface ReviewResult {
  /** Only the subject's turns, in original order. */
  turns: ReviewedTurn[];
  /** Short overall prose review, 3-5 sentences. */
  review: string;
  moments: Moment[];
  /** Per-criterion id, 0 (fails the criterion throughout) to 1 (fully meets it). */
  scores: Record<string, number>;
  meta: {
    rubricId: string;
    rubricVersion: number;
    chunks: number;
    subjectTurns: number;
    /** True when no ChatClient was given, or every LLM call failed, and the heuristic fallback ran instead. */
    usedFallback: boolean;
  };
}

/**
 * Minimal LLM client abstraction — deliberately not tied to any one
 * provider's SDK. Wrap whatever client you already have (Groq, OpenAI,
 * Ollama, Anthropic, ...) in one of these; see examples/cli for a
 * reference adapter.
 */
export interface ChatClient {
  complete(params: { prompt: string; temperature?: number }): Promise<string>;
}

export interface ReviewOptions {
  transcript: Transcript;
  /** The speaker whose turns get judged against the rubric. Everyone else's lines are context only. */
  subject: string;
  rubric: Rubric;
  /** Omit to force the heuristic (no-LLM) fallback — useful for tests, demos, or an unset API key. */
  client?: ChatClient;
}
