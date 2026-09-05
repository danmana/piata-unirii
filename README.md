# Piața Unirii — model comparison

One scene specification, built independently by several coding agents, rendered side by side.

Every run implements the same brief in [`prompt.md`](prompt.md): a voxel-art simulation of
**Piața Unirii in Cluj-Napoca**, anchored by St. Michael's Church and the Matthias Corvinus
monument, with orbit controls, a cinematic flyover and a time-of-day toggle.

## Layout

- `prompt.md` — the shared scene specification handed to every agent.
- `runs/<model>-<effort>-NN/` — one self-contained run; `index.html` is its entry point.
- `comparison/` — a two-pane viewer that loads any two runs side by side.
- `comparison/runs.json` — run metadata (provider, agent, model, effort, start time, duration).

## Running it

Every run is static and offline-only — no build step, no network requests. Serve the repo root
over HTTP and open `/comparison/`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/comparison/
```

Opening a run's `index.html` directly from the filesystem will not work; the ES modules need an
HTTP origin.

## Adding a run

Runs are generated, not hand-written — see [`CLAUDE.md`](CLAUDE.md) for the scaffold rules.
Each agent gets only `prompt.md`, never another run's source.
