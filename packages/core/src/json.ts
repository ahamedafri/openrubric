/**
 * Best-effort JSON parse for LLM output. Providers instructed to
 * return JSON-only occasionally still wrap it in a markdown code
 * fence anyway — strip that before parsing rather than failing the
 * whole chunk over formatting.
 */
export function parseJsonLoose(text: string): unknown | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}
