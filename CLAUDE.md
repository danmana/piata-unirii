# Run scaffold

`prompt.md` is the shared scene specification. When asked to start a run for `<model> <effort>`:

1. Record `startedAt` as an ISO 8601 timestamp before implementation begins.
2. Name it `<model>-<effort>-NN`, using the next free two-digit suffix.
3. Create only `runs/<name>/`, with `index.html` as its entry point and all supporting files inside it.
4. On completion, append `{ "name", "provider", "agent", "model", "effort", "startedAt", "durationSeconds" }` to `comparison/runs.json`. Use `OpenAI` / `Codex` or `Anthropic` / `Claude Code`, and record elapsed wall-clock time in whole seconds.
5. Use only relative local paths. The result must run offline with no network requests.

Do not edit `prompt.md`, other runs, or comparison files other than `comparison/runs.json`.
