# openrubric CLI (example)

A minimal reference CLI built on the `openrubric` library — demonstrates
the whole integration surface a real app needs: a `ChatClient` adapter,
loading a rubric, and rendering the result.

```bash
npm run build
GROQ_API_KEY=... node dist/index.js review --rubric job-interview --subject Me sample-transcript.txt
```

- `--rubric` accepts a built-in name (`job-interview`, `esl-conversation`)
  or a path to your own rubric file.
- `--subject` is the speaker whose turns get judged; if omitted, the CLI
  guesses the first speaker and tells you what it detected.
- `--json` prints the raw `ReviewResult` instead of markdown.
- Transcript input is either a `.json` file (a `Transcript` array) or a
  plain-text file of `Speaker: text` lines, one per turn.
- With no `GROQ_API_KEY`, it runs the heuristic fallback instead of
  erroring — see [../../packages/core/src/heuristic.ts](../../packages/core/src/heuristic.ts).

The `groqClient()` function in [src/index.ts](./src/index.ts) is the
entire adapter openrubric needs from an LLM provider — swap the URL,
model, and headers to point at OpenAI, Ollama, vLLM, or anything else
that speaks the OpenAI chat-completions shape.
