# Track: sub-agents

## Purpose

Research and build a sub-agent architecture for Pi — specialized agents (scout, oracle, worker, tester, reviewer) with ACP-based observability and external monitoring capabilities.

## Read this first

1. `summary.md` — current compressed snapshot.
2. `tasks.md` — active tasks, milestones, and next steps.
3. `references.md` — curated reading path when more context is needed.

## File guide

- `summary.md` — deterministic snapshot refreshed by `/track sync`.
- `tasks.md` — active tasks, milestones, next steps, and checklist items.
- `references.md` — task-specific reading path, not a file inventory.
- `findings.md` — durable non-obvious discoveries.
- `decisions.md` — decisions with rationale and tradeoffs.
- `report.md` — live report; keep it current while working.
- `notes/` — disposable scratch notes when a separate file helps.
- `artifacts/` — outputs worth keeping with the track.

## Update rules

- Tracks can span multiple sessions and milestones; do not treat one completed subtask as automatic grounds for closure.
- Keep `summary.md` compressed and let `/track sync` regenerate it.
- Replace stale text instead of appending endless history.
- Put only durable discoveries in `findings.md` and `decisions.md`.
- Keep `report.md` current while the workstream is active; do not save all useful context for the end.

## Closeout rules

Close the track only when the broader workstream is actually complete, abandoned, or superseded.
Before closing the track:
- refresh the snapshot with `/track sync`
- make sure `report.md` reflects the outcome
- then run `/track end`
