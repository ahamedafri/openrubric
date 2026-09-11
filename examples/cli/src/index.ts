#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRubric, reviewTranscript, type ChatClient, type Rubric, type Transcript } from "openrubric";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This example lives inside the openrubric monorepo, so the bundled
// reference rubrics are just a relative hop away. A standalone install
// of this CLI would ship its own copy of rubrics/ instead.
const REPO_RUBRICS_DIR = path.resolve(__dirname, "../../../rubrics");
const BUILT_IN_RUBRICS = new Set(["job-interview", "esl-conversation"]);

interface Args {
  rubric: string;
  subject: string;
  json: boolean;
  file: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { rubric: "", subject: "", json: false, file: "" };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--rubric") args.rubric = argv[++i] ?? "";
    else if (a === "--subject") args.subject = argv[++i] ?? "";
    else if (a === "--json") args.json = true;
    else rest.push(a);
  }
  args.file = rest[0] ?? "";
  return args;
}

function resolveRubricPath(name: string): string {
  return BUILT_IN_RUBRICS.has(name) ? path.join(REPO_RUBRICS_DIR, `${name}.yaml`) : name;
}

/**
 * v1 transcript input: a .json file holding a Transcript array, or a
 * plain-text file of "Speaker: text" lines — the common shape a Zoom
 * chat export or a quick paste already comes in. A .vtt/.srt parser is
 * explicitly out of scope for this example; bring your own turns.
 */
function parseTranscript(file: string): Transcript {
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".json")) return JSON.parse(text) as Transcript;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) throw new Error(`Expected "Speaker: text", got: ${line}`);
      return { speaker: line.slice(0, idx).trim(), text: line.slice(idx + 1).trim() };
    });
}

/**
 * Reference ChatClient adapter over Groq's OpenAI-compatible endpoint.
 * This is the entire integration surface openrubric needs from a
 * provider — swap the URL/model/headers for any other OpenAI-compatible
 * API (OpenAI itself, Ollama, vLLM, ...) and everything else here is
 * unchanged.
 */
function groqClient(apiKey: string, model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"): ChatClient {
  return {
    async complete({ prompt, temperature = 0.2 }) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Groq request failed: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? "{}";
    },
  };
}

function toMarkdown(result: Awaited<ReturnType<typeof reviewTranscript>>): string {
  const lines: string[] = [];
  lines.push(`# Review${result.meta.usedFallback ? " (heuristic fallback — no LLM client)" : ""}`, "");
  lines.push(result.review, "");
  for (const turn of result.turns) {
    if (turn.findings.length === 0) continue;
    lines.push(`**Turn ${turn.ref}** — "${turn.text}"`);
    for (const f of turn.findings) {
      lines.push(`- [${f.severity}] ${f.criterion}: ${f.note}${f.suggestion ? ` → *${f.suggestion}*` : ""}`);
    }
    lines.push("");
  }
  if (result.moments.length > 0) {
    lines.push("## Moments you could have used differently", "");
    for (const m of result.moments) {
      lines.push(`- Turn ${m.ref} (${m.criterion}): ${m.missing}${m.phrase ? ` — try: ${m.phrase}` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Scores", "");
  for (const [id, score] of Object.entries(result.scores)) lines.push(`- ${id}: ${score.toFixed(2)}`);
  return lines.join("\n");
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const usage = "Usage: openrubric review --rubric <name-or-path> [--subject <speaker>] [--json] <transcript-file>";
  if (cmd !== "review") {
    console.error(usage);
    process.exit(1);
  }
  const args = parseArgs(rest);
  if (!args.rubric || !args.file) {
    console.error(usage);
    process.exit(1);
  }

  const rubric: Rubric = loadRubric(resolveRubricPath(args.rubric));
  const transcript = parseTranscript(args.file);

  const subject = args.subject || transcript[0]?.speaker || "";
  if (!args.subject) {
    const speakers = [...new Set(transcript.map((t) => t.speaker))];
    console.error(`No --subject given. Detected speakers: ${speakers.join(", ")}. Defaulting to "${subject}".`);
  }

  const apiKey = process.env.GROQ_API_KEY;
  const client = apiKey ? groqClient(apiKey) : undefined;
  if (!client) console.error("No GROQ_API_KEY set — running the heuristic fallback only.");

  const result = await reviewTranscript({ transcript, subject, rubric, client });
  console.log(args.json ? JSON.stringify(result, null, 2) : toMarkdown(result));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
