#!/usr/bin/env node
/**
 * Mints a LiveKit room-join token with explicit dispatch to this
 * example's agent — the same technique as Fluency Lab's own
 * src/app/api/live/token/route.ts, standalone here since this example
 * has no web app of its own. Paste the printed URL + token into
 * https://meet.livekit.io ("Custom" connection) to join as the
 * candidate from a browser with a real microphone.
 */
import { AccessToken } from "livekit-server-sdk";
import { RoomConfiguration, RoomAgentDispatch } from "@livekit/protocol";

const AGENT_NAME = "openrubric-interview-example";

async function main() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    console.error("Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (in .env or the environment) first.");
    process.exit(1);
  }

  const roomName = `openrubric-interview-${Date.now()}`;
  const identity = `candidate-${Math.random().toString(36).slice(2, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, { identity });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
  token.roomConfig = new RoomConfiguration({
    name: roomName,
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
  });

  const jwt = await token.toJwt();
  console.log(`URL:   ${url}`);
  console.log(`Token: ${jwt}`);
  console.log(`\nPaste both into https://meet.livekit.io ("Custom" connection) to join as the candidate.`);
  console.log(`Make sure "npm run dev" is already running in another terminal so the agent is online to be dispatched.`);
}

main();
