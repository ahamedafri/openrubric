import { chunkTranscript } from "./chunk.js";
import { reviewHeuristically } from "./heuristic.js";
import { parseJsonLoose } from "./json.js";
import { buildChunkPrompt, buildOverallPrompt } from "./prompt.js";
import type {
  Moment,
  ReviewOptions,
  ReviewResult,
  ReviewedTurn,
  Rubric,
  Severity,
  TurnFinding,
} from "./types.js";

const SEVERITY_PENALTY: Record<Severity, number> = { low: 0.1, medium: 0.25, high: 0.45 };
const VALID_SEVERITIES = new Set<Severity>(["low", "medium", "high"]);

interface RawFinding {
  criterion?: unknown;
  severity?: unknown;
  quote?: unknown;
  note?: unknown;
  suggestion?: unknown;
}
interface RawTurn {
  turnNumber?: unknown;
  findings?: unknown;
}
interface RawMoment {
  turnNumber?: unknown;
  criterion?: unknown;
  missing?: unknown;
  phrase?: unknown;
}
interface RawChunkResponse {
  turns?: RawTurn[];
  moments?: RawMoment[];
}

function sanitizeFindings(raw: unknown, criterionIds: Set<string>): TurnFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: TurnFinding[] = [];
  for (const f of raw as RawFinding[]) {
    if (!f || typeof f !== "object") continue;
    const criterion = String(f.criterion ?? "");
    if (!criterionIds.has(criterion)) continue; // drop findings citing a criterion the rubric doesn't have
    const note = String(f.note ?? "").trim();
    if (!note) continue;
    const severity = VALID_SEVERITIES.has(f.severity as Severity) ? (f.severity as Severity) : "medium";
    out.push({
      criterion,
      severity,
      note,
      quote: typeof f.quote === "string" && f.quote.trim() ? f.quote.trim() : undefined,
      suggestion: typeof f.suggestion === "string" && f.suggestion.trim() ? f.suggestion.trim() : undefined,
    });
  }
  return out;
}

/** Runs the rubric-based review for one chunk. Throws on any LLM/parse failure — the caller decides how to degrade. */
async function reviewChunk(params: {
  rubric: Rubric;
  transcript: ReviewOptions["transcript"];
  refs: number[];
  subjectRefs: number[];
  subject: string;
  client: NonNullable<ReviewOptions["client"]>;
}): Promise<{ turns: ReviewedTurn[]; moments: Moment[] }> {
  const { rubric, transcript, refs, subjectRefs, subject, client } = params;
  const criterionIds = new Set(rubric.criteria.map((c) => c.id));

  const prompt = buildChunkPrompt({ rubric, transcript, refs, subjectRefs, subject });
  const raw = await client.complete({ prompt, temperature: 0.2 });
  const parsed = parseJsonLoose(raw) as RawChunkResponse | undefined;
  if (!parsed) throw new Error("openrubric: model response was not valid JSON");

  // Zip positionally against our own subjectRefs rather than trusting the
  // model to echo turn identity back correctly.
  const turns: ReviewedTurn[] = subjectRefs.map((ref, i) => {
    const turnNumber = i + 1;
    const rawTurn = (parsed.turns ?? []).find((t) => Number(t.turnNumber) === turnNumber);
    return {
      ref,
      speaker: subject,
      text: transcript[ref].text,
      findings: sanitizeFindings(rawTurn?.findings, criterionIds),
    };
  });

  const toMoment = (m: RawMoment): Moment | undefined => {
    const idx = Number(m.turnNumber) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= subjectRefs.length) return undefined;
    const criterion = String(m.criterion ?? "");
    if (!criterionIds.has(criterion)) return undefined;
    const missing = String(m.missing ?? "").trim();
    if (!missing) return undefined;
    return {
      ref: subjectRefs[idx],
      criterion,
      missing,
      phrase: typeof m.phrase === "string" && m.phrase.trim() ? m.phrase.trim() : undefined,
    };
  };

  const moments: Moment[] = (parsed.moments ?? [])
    .filter((m): m is RawMoment => !!m && typeof m === "object")
    .map(toMoment)
    .filter((m): m is Moment => m !== undefined);

  return { turns, moments };
}

function fallbackScore(criterionId: string, turns: ReviewedTurn[]): number {
  let penalty = 0;
  for (const turn of turns) {
    for (const f of turn.findings) {
      if (f.criterion === criterionId) penalty += SEVERITY_PENALTY[f.severity];
    }
  }
  return Math.max(0, 1 - Math.min(1, penalty));
}

async function runOverallPass(params: {
  rubric: Rubric;
  subject: string;
  turns: ReviewedTurn[];
  client: NonNullable<ReviewOptions["client"]>;
}): Promise<{ review: string; scores: Record<string, number> }> {
  const { rubric, subject, turns, client } = params;
  const findingsSummary = turns
    .flatMap((t) => t.findings.map((f) => `turn ${t.ref}: ${f.criterion} (${f.severity}) - ${f.note}`))
    .join("\n");

  const prompt = buildOverallPrompt({ rubric, subject, findingsSummary });
  const raw = await client.complete({ prompt, temperature: 0.3 });
  const parsed = parseJsonLoose(raw) as { review?: unknown; scores?: Record<string, unknown> } | undefined;
  if (!parsed) throw new Error("openrubric: overall-pass response was not valid JSON");

  const scores: Record<string, number> = {};
  for (const c of rubric.criteria) {
    const v = parsed.scores?.[c.id];
    scores[c.id] = typeof v === "number" && v >= 0 && v <= 1 ? v : fallbackScore(c.id, turns);
  }

  const review = typeof parsed.review === "string" && parsed.review.trim() ? parsed.review.trim() : "";
  return { review, scores };
}

/**
 * Reviews `options.subject`'s side of a transcript against a rubric.
 * Without a `client`, always falls back to the regex-level heuristic
 * (see heuristic.ts) rather than throwing — the same "degrade, don't
 * fail" philosophy as the API routes this library grew out of.
 */
export async function reviewTranscript(options: ReviewOptions): Promise<ReviewResult> {
  const { transcript, subject, rubric, client } = options;

  if (!client) return reviewHeuristically({ transcript, subject, rubric });

  const chunkTurns = rubric.length?.chunkTurns ?? 20;
  const chunks = chunkTranscript(transcript, subject, chunkTurns);

  if (chunks.length === 0) {
    return {
      turns: [],
      review: `No turns from "${subject}" were found in this transcript.`,
      moments: [],
      scores: Object.fromEntries(rubric.criteria.map((c) => [c.id, 1])),
      meta: { rubricId: rubric.id, rubricVersion: rubric.version, chunks: 0, subjectTurns: 0, usedFallback: false },
    };
  }

  try {
    const results = await Promise.all(
      chunks.map((chunk) =>
        reviewChunk({ rubric, transcript, refs: chunk.refs, subjectRefs: chunk.subjectRefs, subject, client }),
      ),
    );
    const turns = results.flatMap((r) => r.turns).sort((a, b) => a.ref - b.ref);
    const moments = results.flatMap((r) => r.moments).sort((a, b) => a.ref - b.ref);

    const { review, scores } = await runOverallPass({ rubric, subject, turns, client });

    return {
      turns,
      review: review || "Review generated, but the model did not return overall summary text.",
      moments,
      scores,
      meta: {
        rubricId: rubric.id,
        rubricVersion: rubric.version,
        chunks: chunks.length,
        subjectTurns: turns.length,
        usedFallback: false,
      },
    };
  } catch (err) {
    // Any LLM/parse failure degrades the whole review to the heuristic
    // rather than returning a partially-broken result.
    console.error("[openrubric] LLM review failed, falling back to heuristic check:", err);
    return reviewHeuristically({ transcript, subject, rubric });
  }
}
