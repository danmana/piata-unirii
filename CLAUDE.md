# Run scaffold

`prompt.md` is the shared scene specification. When asked to start a run for `<model> <effort>`:

Existing runs are strictly off-limits: do not open, search, inspect, execute, or copy their contents, and never use them as reference or inspiration. You may read only existing run names or `comparison/runs.json` to choose the next suffix.

1. Record `startedAt` as an ISO 8601 timestamp before implementation begins.
2. Name it `<model>-<effort>-NN`, using the next free two-digit suffix.
3. Create only `runs/<name>/`, with `index.html` as its entry point and all supporting files inside it.
4. On completion, append `{ "name", "provider", "agent", "model", "effort", "startedAt", "durationSeconds" }` to `comparison/runs.json`. Use `OpenAI` / `Codex` or `Anthropic` / `Claude Code`, and record elapsed wall-clock time in whole seconds.
5. Commit only `runs/<name>/` and `comparison/runs.json`; choose an appropriate commit message and do not include unrelated changes.
6. Use only relative local paths. The result must run offline with no network requests.

Do not edit `prompt.md`, other runs, or comparison files other than `comparison/runs.json`.
