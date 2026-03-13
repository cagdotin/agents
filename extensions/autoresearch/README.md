# autoresearch

Autonomous experiment loop infrastructure for pi. Domain-agnostic — specific behavior comes from the `autoresearch-create` skill.

**Source:** [davebcn87/pi-autoresearch](https://github.com/davebcn87/pi-autoresearch)

## Tools

| Tool | Description |
|------|-------------|
| `init_experiment` | One-time session config — name, metric, unit, direction. Writes config header to `autoresearch.jsonl`. |
| `run_experiment` | Runs a shell command, times wall-clock duration, captures output, detects pass/fail via exit code. |
| `log_experiment` | Records result with commit hash, metric, status (`keep`/`discard`/`crash`). Auto-commits on `keep`. Updates widget and dashboard. |

## UI

- **Status widget** — compact one-liner above the editor: `🔬 12 runs 8 kept │ ★ total_µs: 15,586 (-12.3%)`
- **Ctrl+X** — toggle expanded dashboard table inline
- **Ctrl+Shift+X** — fullscreen scrollable dashboard overlay

## Command

- `/autoresearch` — enter autoresearch mode (reads `autoresearch.md` if present, or triggers setup)
- `/autoresearch off` — disable autoresearch mode

## Behavior

- Persists experiment history to `autoresearch.jsonl` (append-only, one line per run)
- Reconstructs state from `autoresearch.jsonl` on session start/switch/fork
- Falls back to session history reconstruction for backward compatibility
- Injects autoresearch context into system prompt via `before_agent_start` when mode is active
- Auto-resumes experiment loop on `agent_end` (rate-limited to once per 5 minutes)

## Files (in project cwd)

| File | Purpose |
|------|---------|
| `autoresearch.md` | Living session document — objective, metrics, what's been tried |
| `autoresearch.sh` | Benchmark script — pre-checks, runs workload, outputs `METRIC name=number` |
| `autoresearch.jsonl` | Append-only experiment log |
| `autoresearch.ideas.md` | Optional backlog of promising but deferred ideas |

## Dependencies

Uses `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`, and `@sinclair/typebox` (all peer deps from pi).
