import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Rubric } from "./types.js";

const criterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  guidance: z.string().min(1),
  severityHints: z
    .object({
      low: z.string().optional(),
      medium: z.string().optional(),
      high: z.string().optional(),
    })
    .optional(),
  examples: z
    .object({
      weak: z.string().optional(),
      strong: z.string().optional(),
    })
    .optional(),
});

const rubricSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  description: z.string().optional(),
  language: z.string().optional(),
  criteria: z.array(criterionSchema).min(1),
  phraseBank: z.record(z.string(), z.array(z.string())).optional(),
  length: z
    .object({
      minSubjectTurns: z.number().int().nonnegative().optional(),
      longTranscriptStrategy: z.enum(["map-reduce", "truncate", "single-pass"]).optional(),
      chunkTurns: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * Accepts the rubric's own on-disk shape, which uses snake_case for
 * multi-word keys (phrase_bank, severity_hints, ...) because it's meant
 * to be hand-written YAML, not authored TypeScript. This is the one
 * place that translates snake_case -> the library's camelCase types.
 */
function fromWireShape(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  const criteria = Array.isArray(obj.criteria)
    ? obj.criteria.map((c) => {
        if (typeof c !== "object" || c === null) return c;
        const crit = c as Record<string, unknown>;
        return {
          ...crit,
          severityHints: crit.severity_hints ?? crit.severityHints,
        };
      })
    : obj.criteria;
  return {
    ...obj,
    criteria,
    phraseBank: obj.phrase_bank ?? obj.phraseBank,
    length:
      typeof obj.length === "object" && obj.length !== null
        ? {
            ...(obj.length as Record<string, unknown>),
            minSubjectTurns:
              (obj.length as Record<string, unknown>).min_subject_turns ??
              (obj.length as Record<string, unknown>).minSubjectTurns,
            longTranscriptStrategy:
              (obj.length as Record<string, unknown>).long_transcript_strategy ??
              (obj.length as Record<string, unknown>).longTranscriptStrategy,
            chunkTurns:
              (obj.length as Record<string, unknown>).chunk_turns ??
              (obj.length as Record<string, unknown>).chunkTurns,
          }
        : obj.length,
  };
}

export class RubricValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "RubricValidationError";
  }
}

function validate(raw: unknown): Rubric {
  const result = rubricSchema.safeParse(fromWireShape(raw));
  if (!result.success) {
    throw new RubricValidationError(
      `Invalid rubric: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      result.error.issues,
    );
  }
  return result.data;
}

/**
 * Load a rubric from a plain object (already parsed), a YAML string, or
 * a path to a .yaml/.yml/.json file. Throws RubricValidationError if the
 * shape doesn't match — a rubric with a typo'd criterion id fails loudly
 * here rather than silently producing empty findings at review time.
 */
export function loadRubric(source: string | Record<string, unknown>): Rubric {
  if (typeof source !== "string") return validate(source);

  const looksLikePath = /\.(ya?ml|json)$/i.test(source) && !source.includes("\n");
  const text = looksLikePath ? readFileSync(source, "utf8") : source;
  const parsed = /^\s*[{[]/.test(text) ? JSON.parse(text) : parseYaml(text);
  return validate(parsed);
}
