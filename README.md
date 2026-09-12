# openrubric

[![CI](https://github.com/ahamedafri/openrubric/actions/workflows/ci.yml/badge.svg)](https://github.com/ahamedafri/openrubric/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/openrubric)](https://www.npmjs.com/package/openrubric)
[![license](https://img.shields.io/npm/l/openrubric)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/openrubric)](https://www.npmjs.com/package/openrubric)

Rubric-scored feedback on any conversation transcript. Bring your own
LLM client, bring your own rubric.

```bash
npm install openrubric
```

```ts
import { reviewTranscript, loadRubric } from "openrubric";

const rubric = loadRubric("./rubrics/job-interview.yaml");

const result = await reviewTranscript({
  transcript: [
    { speaker: "Interviewer", text: "Tell me about a hard bug you fixed." },
    { speaker: "Me", text: "Um, so there was like this thing where maybe the cache..." },
  ],
  subject: "Me", // whose turns get judged — everyone else is context
  rubric,
  client: myChatClient, // any OpenAI-compatible provider — see below
});

console.log(result.review);   // 3-5 sentence overall review
console.log(result.moments);  // "you could have said ___" moments, with a phrase to try
console.log(result.scores);   // per-criterion 0..1
```

## Why this exists

Interview-prep apps, sales-call coaching tools, support-QA dashboards, and
language-learning apps all reimplement the same feedback loop: send a
transcript and a rubric to an LLM, force structured output, validate it,
turn it into specific per-turn findings instead of generic advice. That
20% is the hard part — chunking long transcripts, keeping the model
honest about which turn it's judging, degrading gracefully with no API
key. Only the rubric differs between use cases, and a rubric is just a
YAML file anyone can write and share.

## Use cases

- **Interview prep** — mock interview transcript in, "you never stated a
  result in answer 3" out.
- **Sales call review** — discovery-call transcript in, "didn't ask about
  budget, talked 68% of the time" out.
- **Language learning** — voice-conversation transcript in, line-by-line
  grammar and phrase-frame suggestions out.
- **Support/success QA** — nightly batch review of call transcripts,
  flagging the ones a human should actually listen to.
- **Oral exams, presentations, difficult-conversation training, coaching
  fidelity review, interviewer self-review, debate coaching, discourse
  research** — same engine, a different rubric.

See [rubrics/](./rubrics) for two ready-to-use examples.

## The rubric format

A rubric is a YAML (or JSON) file — the whole point is that it's not
code, so anyone can write and contribute one:

```yaml
id: job-interview
version: 1
description: Behavioral / technical interview answers, candidate side.

criteria:
  - id: specificity
    label: Concrete detail
    guidance: >
      A strong answer names real systems, numbers, and outcomes. Flag
      answers that would fit any candidate for any job.
    examples:
      weak: "I improved performance a lot."
      strong: "I cut p99 latency from 800ms to 210ms by batching the writes."

phrase_bank:
  structure:
    - '"The situation was ___. I did ___. As a result, ___."'
```

See the full schema in [packages/core/src/rubric.ts](./packages/core/src/rubric.ts)
and two complete examples in [rubrics/](./rubrics). **Contributing a
rubric for a new use case is the easiest way to help this project** — no
engine code required.

## Bringing your own LLM client

openrubric depends on no provider SDK. Implement one method:

```ts
interface ChatClient {
  complete(params: { prompt: string; temperature?: number }): Promise<string>;
}
```

A working adapter for Groq (and, by the same three lines, any other
OpenAI-compatible endpoint — OpenAI itself, Ollama, vLLM) is in
[examples/cli/src/index.ts](./examples/cli/src/index.ts).

## What it does NOT do (by design)

- No speech-to-text — you bring a transcript.
- No web UI, accounts, or hosting.
- No automatic speaker diarization — you say which speaker is the subject.
- No live/real-time coaching — this is a post-hoc, batch review.

## Try the CLI

```bash
cd examples/cli
npm run build
GROQ_API_KEY=... node dist/index.js review --rubric job-interview --subject Me sample-transcript.txt
```

Without an API key set, the same command runs a heuristic fallback
(filler/hedging/length signals only) instead of erroring — useful for
demos, tests, and outages.

## Repo layout

```
packages/core     openrubric itself — reviewTranscript(), rubric loading, types
rubrics/          reference rubrics (job-interview, esl-conversation)
examples/cli      a working CLI built on the library, including a Groq adapter
```

## Development

```bash
npm install
npm test     # fixture-based tests, no network calls
npm run build
```

## License

MIT — see [LICENSE](./LICENSE).
