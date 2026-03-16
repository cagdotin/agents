# Track: agent-memory

## Purpose

Research, evaluate, and integrate agent memory/context management improvements — covering QMD, OpenViking patterns, and enhancements to our expertise/tracks systems

## Read this first

1. `summary.md` — current compressed snapshot.
2. `tasks.md` — active tasks, milestones, and next steps across all memory streams.
3. `workstreams/` — consolidated stream notes from former `track-extension` and `expert-extension-rework` tracks.
4. `workstreams/qmd-tui-search.md` — TUI search exploration (design brainstorm, incorporated into panel redesign).
5. `specs/qmd-extension-v1.md` — QMD extension v1 design spec.
5. `exec-plans/qmd-extension-v1.md` — QMD extension v1 execution plan.
6. `references.md` — curated reading path when more context is needed.

### Active: QMD Panel Split-Pane Redesign

- **Spec:** `docs/specs/2026-03-16-qmd-panel-split-pane-redesign.md`
- **Implementation spec:** `docs/specs/2026-03-16-qmd-panel-split-pane-implementation.md` ← **start here for implementation**
- **Plan:** `docs/exec-plans/active/2026-03-16-qmd-panel-split-pane-redesign.md`
- **Prior exploration:** `workstreams/qmd-tui-search.md` (search design, now folded into milestones 5-7)
- **Inspiration:** [LazyQMD](https://github.com/AlexZeitler/lazyqmd) — persistent sidebar, search modes, collection management

## File guide

- `summary.md` — deterministic snapshot refreshed by `/track sync`.
- `tasks.md` — active tasks, milestones, next steps, and checklist items.
- `workstreams/` — per-stream consolidated notes (QMD, tracks extension, expert extension).
- `specs/` — design specs for planned work.
- `exec-plans/` — execution plans with milestones and checklists.
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
