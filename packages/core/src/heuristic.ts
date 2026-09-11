import type { Criterion, ReviewedTurn, ReviewResult, Rubric, Transcript } from "./types.js";

const FILLER_PHRASES = ["um", "uh", "erm", "you know", "i mean"];
const HEDGE_PHRASES = ["i think maybe", "sort of", "kind of", "i guess", "i suppose", "probably", "maybe"];

function countMatches(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  return phrases.reduce((n, phrase) => n + (lower.split(phrase).length - 1), 0);
}

/** Best-effort: find a criterion whose id or label suggests it covers hedging/filler/confidence, or length/detail. */
function findCriterionByKeyword(rubric: Rubric, keywords: string[]): Criterion | undefined {
  return rubric.criteria.find((c) =>
    keywords.some((k) => c.id.toLowerCase().includes(k) || c.label.toLowerCase().includes(k)),
  );
}

/**
 * No-LLM fallback: regex-level filler/hedging/length signals only. It
 * cannot judge content against a rubric's actual guidance, so it says
 * so plainly rather than pretending to a confidence it doesn't have —
 * the same honesty as the heuristic() fallbacks this library grew out
 * of. Always returns a valid ReviewResult so callers never need a
 * separate no-LLM code path.
 */
export function reviewHeuristically(params: { transcript: Transcript; subject: string; rubric: Rubric }): ReviewResult {
  const { transcript, subject, rubric } = params;
  const subjectRefs = transcript.reduce<number[]>((acc, t, i) => {
    if (t.speaker === subject) acc.push(i);
    return acc;
  }, []);

  const hedgeCriterion = findCriterionByKeyword(rubric, ["hedg", "filler", "confiden"]);
  const detailCriterion = findCriterionByKeyword(rubric, ["specific", "detail", "substance", "structure"]);

  const turns: ReviewedTurn[] = subjectRefs.map((ref) => {
    const text = transcript[ref].text;
    const words = text.split(/\s+/).filter(Boolean);
    const fillerCount = countMatches(text, FILLER_PHRASES);
    const hedgeCount = countMatches(text, HEDGE_PHRASES);

    const findings: ReviewedTurn["findings"] = [];
    if (hedgeCriterion && fillerCount + hedgeCount > 0) {
      findings.push({
        criterion: hedgeCriterion.id,
        severity: fillerCount + hedgeCount > 2 ? "medium" : "low",
        note: `Heuristic count only (no LLM client): ${fillerCount + hedgeCount} filler/hedging phrase(s) detected — this check can't tell whether any of them actually weakened the point.`,
      });
    }
    if (detailCriterion && words.length < 6) {
      findings.push({
        criterion: detailCriterion.id,
        severity: "low",
        note: `Heuristic length check only (no LLM client): a ${words.length}-word turn — too short to judge content, flagged for a human or LLM pass to confirm.`,
      });
    }
    return { ref, speaker: subject, text, findings };
  });

  const scores: Record<string, number> = {};
  for (const c of rubric.criteria) scores[c.id] = 0.5;

  return {
    turns,
    review:
      "This is a heuristic check only (no LLM client was provided) — it flags filler/hedging density and very short turns, and cannot judge content against the rubric's actual criteria. Pass a ChatClient to reviewTranscript() for a real review.",
    moments: [],
    scores,
    meta: {
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      chunks: 0,
      subjectTurns: subjectRefs.length,
      usedFallback: true,
    },
  };
}
