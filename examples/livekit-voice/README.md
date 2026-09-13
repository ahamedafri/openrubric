# openrubric + LiveKit voice example

A LiveKit Agents worker that plays an AI interviewer over voice, then
runs the candidate's side of the call through openrubric's
`job-interview` rubric the moment they hang up.

This is the "record a call, then review it" shape openrubric was
originally pulled out of — everything before the review step is just a
LiveKit Agents voice pipeline; the only openrubric-specific code is the
one `reviewTranscript()` call in [`src/agent.ts`](./src/agent.ts)'s
shutdown callback.

## Setup

```bash
npm install
cp .env.example .env   # fill in your LiveKit + Groq credentials
```

You need a [LiveKit Cloud](https://cloud.livekit.io) project (free tier
is enough) and a [Groq](https://console.groq.com) API key.

## Run it

**Terminal 1** — start the worker:

```bash
npm run dev
```

**Terminal 2** — mint a token and join as the candidate:

```bash
npm run mint-token
```

Paste the printed URL and token into [meet.livekit.io](https://meet.livekit.io)
("Custom" connection) from a browser with a working microphone. The
agent will greet you and ask a few interview questions.

When you hang up (leave the room), watch **Terminal 1** — within a few
seconds it prints the openrubric review: an overall assessment, scores
per criterion, and specific findings quoting what you actually said.

## What's actually happening

1. `src/agent.ts` joins the room and runs a standard LiveKit Agents
   voice pipeline (STT/TTS via LiveKit Inference, conversational LLM via
   Groq) — this part is unrelated to openrubric, and mirrors the working
   pattern in a previously-built reference voice agent.
2. Every conversation turn is captured into openrubric's own
   `Transcript` shape (`{ speaker, text }[]`) as it happens, tagging
   which speaker is the candidate — no separate transcription step.
3. On hangup, `ctx.addShutdownCallback()` calls
   `reviewTranscript({ transcript, subject: "Candidate", rubric, client })`
   against the bundled `job-interview.yaml` rubric, using the same
   Groq `ChatClient` adapter as [`examples/cli`](../cli).
4. The result is printed to the worker's own console — there's no web
   UI here. A real integration would POST it wherever the caller wants
   it displayed, the same way Fluency Lab's own agent POSTs results
   back to its Next.js app.

## Notes

- `mint-token.mjs` dispatches explicitly to this example's agent
  (`agentName: "openrubric-interview-example"`) — it won't be dispatched
  to any other LiveKit Agents worker you might have running.
- Swap the rubric (or the interviewer persona in `INTERVIEWER_INSTRUCTIONS`)
  to try this against `esl-conversation`, `sales-discovery`, or any
  other rubric in [`../../rubrics`](../../rubrics) — just change the
  `subject` name and the loaded path to match.
