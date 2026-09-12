# openrubric

[![CI](https://github.com/ahamedafri/openrubric/actions/workflows/ci.yml/badge.svg)](https://github.com/ahamedafri/openrubric/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/openrubric)](https://www.npmjs.com/package/openrubric)
[![license](https://img.shields.io/npm/l/openrubric)](https://github.com/ahamedafri/openrubric/blob/main/LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/openrubric)](https://www.npmjs.com/package/openrubric)

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
