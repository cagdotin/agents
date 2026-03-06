# QUALITY

Status: active  
Last updated: 2026-03-07

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
| Resource knowledge base (`docs/resources`) | 3 | Good | Strong frontmatter schema and summaries; continue consistent tagging/related links |
| `extensions/answer` | 3 | Good | Solid README and clear flow; low active maintenance load |
| `extensions/todos` | 3 | Good | Strong implementation and TUI; docs were stale and are now refreshed |
| `extensions/expert` | 4 | Excellent | Matching now uses aliases/keywords/pattern hints, injection is context-budget-aware, and `/expert log` + `/expert init` close the main UX gaps |
| `extensions/tmux-notify` | 3 | Good | Useful and focused; now documented |
| `extensions/tmux-pane-title` | 3 | Good | Useful and focused; now documented |
| Skills (`skills/*`) | 3 | Good | Consistent SKILL format and clear purpose |
| Mechanical validation | 3 | Good | `bun run check` now gates Biome + docs validation (`scripts/validate-docs.ts`) and is enforced locally via Lefthook pre-commit |

---

## Priority Gaps

## P0 (next)

- None currently.

## P1

- None currently.

## P2

1. Add `specs/` usage for larger planned extensions (subagent/widget/team patterns).
2. Introduce component-level quality trend tracking over time (monthly snapshots).

---

## Definition of “Healthy” for This Repo

A healthy state means:

- New contributors can navigate from `AGENTS.md` → architecture docs → exact extension/skill docs quickly.
- Each extension directory has a practical README with triggers, setup, and behavior.
- New external resources can be added using a template with consistent metadata.
- Documentation and workflows consistently use Bun commands (`bun`, `bun run`, `bunx`).
- Known gaps are explicitly tracked here or in `.pi/todos`, not only in chat.
