<h1 align="center">OpenRubric</h1>

<p align="center">
  <img src="https://raw.githubusercontent.com/ahamedafri/openrubric/main/docs/mascot.svg" width="160" alt="Rubi, the openrubric mascot">
</p>

<p align="center">
  <a href="https://github.com/ahamedafri/openrubric/actions/workflows/ci.yml"><img src="https://github.com/ahamedafri/openrubric/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/openrubric"><img src="https://img.shields.io/npm/v/openrubric" alt="npm version"></a>
  <a href="https://github.com/ahamedafri/openrubric/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/openrubric" alt="license"></a>
  <a href="https://www.npmjs.com/package/openrubric"><img src="https://img.shields.io/npm/dm/openrubric" alt="npm downloads"></a>
  <a href="https://badge.socket.dev/npm/package/openrubric/0.1.2"><img src="https://badge.socket.dev/npm/package/openrubric/0.1.2" alt="Socket Badge"></a>
</p>

Rubric-scored feedback on any conversation transcript. Bring your own
LLM client, bring your own rubric.

See the [project README](https://github.com/ahamedafri/openrubric#readme)
for the full pitch, use cases, the rubric format, and a working CLI
example — this package is just the library:

```bash
npm install openrubric
```

```ts
import { reviewTranscript, loadRubric } from "openrubric";

const result = await reviewTranscript({
  transcript: [{ speaker: "Interviewer", text: "..." }, { speaker: "Me", text: "..." }],
  subject: "Me",
  rubric: loadRubric("./job-interview.yaml"),
  client: myChatClient, // { complete({ prompt, temperature }) => Promise<string> }
});
```

MIT licensed.
