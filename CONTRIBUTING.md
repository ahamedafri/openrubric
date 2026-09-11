# Contributing

## Adding a rubric (the easiest way to help)

A rubric is a plain YAML file — no engine code required. To add one for a
new use case (sales calls, oral exams, coaching fidelity, whatever you
need):

1. Copy the shape of an existing rubric, e.g. [rubrics/job-interview.yaml](./rubrics/job-interview.yaml).
2. Save it as `rubrics/<your-id>.yaml`, where `<your-id>` matches the
   `id:` field inside the file — `sales-discovery.yaml` has `id:
   sales-discovery`. This is enforced by CI, not just a convention.
3. Each criterion needs an `id`, a `label`, and `guidance` that's specific
   enough for an LLM to apply consistently — "flag vague answers" is too
   thin; say what "vague" looks like and give a `weak`/`strong` example
   pair if you can (see the schema in [packages/core/src/rubric.ts](./packages/core/src/rubric.ts)).
4. Open a PR. `npm test` runs [rubrics-repo.test.ts](./packages/core/src/rubrics-repo.test.ts)
   against every file in `rubrics/` automatically — it checks your YAML
   parses, every criterion has an id and guidance, your filename matches
   your rubric's `id`, and no id collides with an existing rubric. No
   need to write your own test.
5. If you can, run your rubric against a real transcript with the CLI
   (`examples/cli`) and paste the output in your PR description — it's
   the fastest way for a reviewer to judge whether the guidance actually
   produces specific findings instead of generic advice.

## Contributing to the engine (`packages/core`)

- TypeScript strict mode; keep the public API in [types.ts](./packages/core/src/types.ts)
  and [index.ts](./packages/core/src/index.ts) narrow and typed.
- Tests are fixture-based and must not make real network/LLM calls — mock
  the `ChatClient` with recorded responses, as in
  [review.test.ts](./packages/core/src/review.test.ts). This keeps CI
  fast, free, and deterministic despite the underlying task being
  nondeterministic.
- Prefer failing safe: any LLM/parse error should degrade toward the
  heuristic fallback rather than throwing out of `reviewTranscript()`.
- Run `npm test` and `npm run build` before opening a PR.

## Reporting a bad review

If a rubric consistently produces vague or wrong feedback on real
transcripts, that's a bug — open an issue with the rubric id, an
anonymized transcript excerpt, and what you'd have expected instead.
