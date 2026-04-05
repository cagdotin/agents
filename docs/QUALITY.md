# QUALITY

Status: active
Last updated: 2026-04-05

This scorecard tracks maintainability and readiness of this package for day-to-day agent use.

## Rubric

- **4 (Excellent)** — clear docs, strong UX, low risk
- **3 (Good)** — usable and documented, some known gaps
- **2 (Fair)** — works but has notable gaps or rough edges
- **1 (Poor)** — fragile, unclear, or incomplete

---

## Component Scorecard

| Area | Score | Status | Notes |
|---|---:|---|---|
| Repository architecture docs | 3 | Good | `ARCHITECTURE.md` and this quality file now exist; keep updated as structure evolves |
| Design principles (`docs/DESIGN-PRINCIPLES.md`) | 3 | Good | Distilled from 9 resource analyses; full analyses migrated to vault |
| `extensions/cmux` | 3 | Good | Auto-detects cmux environment and injects skill for topology/browser/markdown control |
| `extensions/qmd` | 3 | Good | QMD semantic search panel with split-pane preview, multi-collection support, and repo-first onboarding |
| `extensions/todos` | 3 | Good | Strong implementation and TUI; docs were stale and are now refreshed |
| `extensions/tracks` | 3 | Good | Repo-agnostic workstream contexts with deterministic sync, local AGENTS.md, and subcommand-aware slash-command UX |
| Skills (`skills/*`) | 3 | Good | Consistent SKILL format and clear purpose |
| Mechanical validation | 4 | Excellent | `bun run check` gates Biome + docs + boundary invariants + Vitest; Lefthook pre-commit runs all four in parallel |
| Automated testing | 3 | Good | Tier 1 and Tier 2 are in use with shared mocks; Tier 3 runtime-heavy testing is still deferred |

---

## Testing posture

For test conventions, mock strategy, and boundaries, see `docs/TESTING.md`.

Current posture:
- Tier 1 and Tier 2 coverage exists across multiple extensions and scripts.
- Tier 3 code is still mostly untested because it is tightly coupled to the Pi runtime.
- The best next candidates for more coverage are `todos/tool.ts` and `tracks/tool.ts`, where logic could be extracted or tested with shared mocks.
- If deeper runtime testing becomes important, we need a Pi test harness or a mock session/context factory.

---

## Priority Gaps

## P0 (next)

- None currently.

## P1

- None currently.

## P2

1. Enforce habitual use of `docs/specs/` + `docs/exec-plans/` for all medium/large initiatives (the `plan` skill now supports both; adoption still needs consistency).
2. Introduce component-level quality trend tracking over time (monthly snapshots).

---

## Definition of “Healthy” for This Repo

A healthy state means:

- New contributors can navigate from `AGENTS.md` → architecture docs → exact extension/skill docs quickly.
- Each extension directory has a practical README with triggers, setup, and behavior.
- Documentation and workflows consistently use Bun commands (`bun`, `bun run`, `bunx`).
- Known gaps are explicitly tracked here or in `.pi/todos`, not only in chat.
