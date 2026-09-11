import type { Rubric, Transcript } from "./types.js";

function criteriaBlock(rubric: Rubric): string {
  return rubric.criteria
    .map((c) => {
      let line = `- ${c.id} ("${c.label}"): ${c.guidance}`;
      if (c.examples?.weak || c.examples?.strong) {
        line += `\n  Weak example: ${c.examples.weak ?? "(none given)"}`;
        line += `\n  Strong example: ${c.examples.strong ?? "(none given)"}`;
      }
      return line;
    })
    .join("\n");
}

export function buildChunkPrompt(params: {
  rubric: Rubric;
  transcript: Transcript;
  refs: number[];
  subjectRefs: number[];
  subject: string;
}): string {
  const { rubric, transcript, refs, subjectRefs, subject } = params;

  const windowText = refs.map((i) => `${i}: ${transcript[i].speaker}: ${transcript[i].text}`).join("\n");
  const numbered = subjectRefs.map((i, n) => `${n + 1}. "${transcript[i].text}"`).join("\n");

  return `You are reviewing ${subject}'s side of a conversation against a fixed rubric. Judge only ${subject}'s turns below — every other line is context for understanding them, not something to score.

Rubric: ${rubric.description ?? rubric.id}

Criteria (use ONLY these ids in "criterion" — never invent one):
${criteriaBlock(rubric)}

Conversation window (line numbers are absolute positions, not the numbering below):
${windowText}

${subject}'s turns to judge, numbered 1 to ${subjectRefs.length} in order:
${numbered}

For each numbered turn, list findings ONLY where a criterion is clearly and specifically relevant — most solid turns should get zero findings, not a token comment against every criterion. Each finding needs:
- "criterion": one of the ids above
- "severity": "low" | "medium" | "high"
- "quote": the short exact words the finding is about (omit if it's about the whole turn)
- "note": one sentence naming what was actually said — never generic advice like "be more confident"
- "suggestion": a concrete alternative phrasing for this exact moment, when one would help

Also list 0-3 "moments" across the whole window: turns with real room for a stronger phrasing that isn't a strict rubric violation. Each needs "turnNumber" (matching the numbering above), "criterion", "missing" (what was absent), and "phrase" (a concrete alternative for this situation).

Respond ONLY with JSON, no prose outside it:
{
  "turns": [
    { "turnNumber": 1, "findings": [ { "criterion": "...", "severity": "medium", "quote": "...", "note": "...", "suggestion": "..." } ] }
  ],
  "moments": [
    { "turnNumber": 2, "criterion": "...", "missing": "...", "phrase": "..." }
  ]
}`;
}

export function buildOverallPrompt(params: { rubric: Rubric; subject: string; findingsSummary: string }): string {
  const { rubric, subject, findingsSummary } = params;
  return `You already extracted specific findings about ${subject}'s side of a conversation, judged against this rubric: ${rubric.description ?? rubric.id}.

Findings summary (one line per finding, "turn: criterion (severity) - note"):
${findingsSummary || "(no findings were raised against any turn)"}

Write a short overall review of ${subject}'s performance: 3-5 sentences, second person, honest about what worked and what didn't, specific rather than generic. Then score each criterion from 0.0 (fails it throughout) to 1.0 (fully meets it), weighing how often and how severely it came up above — no findings for a criterion generally means it scores high, not that it's unscored.

Criteria to score: ${rubric.criteria.map((c) => c.id).join(", ")}

Respond ONLY with JSON:
{ "review": "...", "scores": { "<criterion id>": 0.0 } }`;
}
