# Run scaffold

`prompt.md` is the shared scene specification. When asked to start a run for `<model> <effort>`:

1. Name it `<model>-<effort>-NN`, using the next free two-digit suffix.
2. Create only `runs/<name>/`, with `index.html` as its entry point and all supporting files inside it.
3. Append `{ "name", "model", "effort" }` to `comparison/runs.json`.
4. Use only relative local paths. The result must run offline with no network requests.

Do not edit `prompt.md`, other runs, or comparison files other than `comparison/runs.json`.
