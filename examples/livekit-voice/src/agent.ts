/**
 * A LiveKit Agents worker that plays an AI interviewer, then reviews
 * the candidate's side of the call with openrubric the moment the
 * call ends.
 *
 * This mirrors the working pattern in Fluency Lab's own voice agent
 * (a separate, previously-built project: STT/TTS via LiveKit Inference,
 * the conversational LLM via Groq through the openai plugin's
 * withGroq() helper) rather than being reinvented from scratch — the
 * only new part is what happens in the shutdown callback: instead of a
 * one-off hand-written evaluation prompt, it's a single
 * `reviewTranscript()` call against a rubric that ships with this repo.
 *
 * Run standalone (separate process, not part of any web app):
 *   npm run dev
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ServerOptions, cli, defineAgent, voice, type JobContext } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { loadRubric, reviewTranscript, type ChatClient, type Transcript } from 'openrubric';

type ProcData = { vad?: silero.VAD };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This example lives inside the openrubric monorepo, so the reference
// rubric is a relative hop away. A standalone integration would ship
// its own copy of the rubric file instead — see examples/cli for the
// same convention.
const JOB_INTERVIEW_RUBRIC_PATH = path.resolve(__dirname, '../../../rubrics/job-interview.yaml');

const AGENT_NAME = 'openrubric-interview-example';
const VOICE_LLM_MODEL = process.env.VOICE_LLM_MODEL ?? 'openai/gpt-oss-120b';
const REVIEW_MODEL = process.env.REVIEW_MODEL ?? 'openai/gpt-oss-120b';
const MAX_QUESTIONS = 4;

const INTERVIEWER_INSTRUCTIONS = [
  'You are a friendly but focused technical interviewer conducting a short practice interview.',
  'Ask one behavioral or technical question at a time — "tell me about a time you..." style questions work well.',
  "React briefly to the candidate's answer, then move to your next question. Don't coach them or give feedback during the call — that happens after, separately.",
  'You are speaking out loud: no markdown, no bullet points, no stage directions.',
  `After about ${MAX_QUESTIONS} questions, thank the candidate and say the interview is complete, then stop talking.`,
].join(' ');

/** Shared LiveKit Inference STT/TTS + Groq conversational LLM, same providers Fluency Lab's own agent uses. */
function createAgentSession(vad: silero.VAD | undefined): voice.AgentSession {
  return new voice.AgentSession({
    vad,
    stt: process.env.STT_MODEL ?? 'deepgram/nova-3',
    tts: process.env.TTS_MODEL ?? 'cartesia/sonic-2',
    llm: openai.LLM.withGroq({ model: VOICE_LLM_MODEL, temperature: 0.7 }),
  });
}

/**
 * The same minimal ChatClient adapter as examples/cli — openrubric's
 * entire integration surface with a provider. Swap the URL/model for
 * any other OpenAI-compatible endpoint.
 */
function groqClient(apiKey: string): ChatClient {
  return {
    async complete({ prompt, temperature = 0.2 }) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: REVIEW_MODEL,
          temperature,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Groq request failed: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '{}';
    },
  };
}

async function runInterviewJob(ctx: JobContext<ProcData>): Promise<void> {
  const roomName = ctx.room.name ?? '';
  console.log(`[agent] interview job starting. room="${roomName}"`);

  const session = createAgentSession(ctx.proc.userData.vad);

  // Same speaker-labeled-lines technique as Fluency Lab's agent, but
  // kept as openrubric's own Transcript shape from the start instead of
  // joined strings, since that's what reviewTranscript() takes directly.
  const transcript: Transcript = [];
  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    const item = ev.item;
    if (item.type !== 'message') return;
    const text = item.textContent?.trim();
    if (!text) return;
    transcript.push({ speaker: item.role === 'user' ? 'Candidate' : 'Interviewer', text });
  });

  ctx.addShutdownCallback(async () => {
    console.log(`[agent] shutting down, ${transcript.length} line(s) recorded`);
    const candidateTurns = transcript.filter((t) => t.speaker === 'Candidate').length;
    if (candidateTurns === 0) {
      console.log('[agent] candidate never spoke — skipping review.');
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log('[agent] no GROQ_API_KEY set — skipping review (the interview itself still ran on Groq via the LiveKit Inference LLM plugin, but this separate review call needs its own key).');
      return;
    }

    const rubric = loadRubric(readFileSync(JOB_INTERVIEW_RUBRIC_PATH, 'utf8'));
    const result = await reviewTranscript({
      transcript,
      subject: 'Candidate',
      rubric,
      client: groqClient(apiKey),
    });

    console.log('\n=== openrubric review ===\n');
    console.log(result.review);
    console.log('\nScores:', result.scores);
    console.log(`\nFull JSON:\n${JSON.stringify(result, null, 2)}`);
  });

  const agent = new voice.Agent({ instructions: INTERVIEWER_INSTRUCTIONS });
  await session.start({ agent, room: ctx.room });
  session.generateReply({ instructions: 'Greet the candidate briefly, then ask your first interview question.' });
}

export default defineAgent<ProcData>({
  prewarm: async (proc) => {
    proc.userData.vad = (await silero.VAD.load()) as silero.VAD;
  },
  entry: async (ctx: JobContext<ProcData>) => {
    await ctx.connect();
    return runInterviewJob(ctx);
  },
});

// Only the process launched from the command line starts a worker — see
// Fluency Lab's agent/src/main.ts for why this guard matters (the
// framework re-imports this file inside each job subprocess).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: AGENT_NAME,
      numIdleProcesses: 1,
      initializeProcessTimeout: 60_000,
    }),
  );
}
