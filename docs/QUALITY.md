# QUALITY

Status: active
Last updated: 2026-03-11

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
| `extensions/damage-control` | 3 | Good | Default-on guardrails for YOLO mode with layered rules (bundled + global + nearest project); keep tuning false-positive/false-negative balance |
| `extensions/session-stats` | 3 | Good | In-session observability panel with tool call charts, detail drill-downs, file timeline mode, and model history |
| `extensions/tmux` | 3 | Good | Unified tmux integration (notify + pane title); documented |
| `extensions/cmux` | 3 | Good | Auto-detects cmux environment and injects skill for topology/browser/markdown control |
| Skills (`skills/*`) | 3 | Good | Consistent SKILL format and clear purpose |
| Mechanical validation | 4 | Excellent | `bun run check` gates Biome + docs + boundary invariants + Vitest; Lefthook pre-commit runs all four in parallel |
| Automated testing | 3 | Good | Tier 1 and Tier 2 are in use with shared mocks; Tier 3 runtime-heavy testing is still deferred |

---

## Testing posture

For test conventions, mock strategy, and boundaries, see `docs/TESTING.md`.

Current posture:
- Tier 1 and Tier 2 coverage exists across multiple extensions and scripts.
- Tier 3 code is still mostly untested because it is tightly coupled to the Pi runtime.
- The best next candidates for more coverage are `expert/tool.ts`, `todos/tool.ts`, and `session-stats/panel.ts`, where logic could be extracted or tested with shared mocks.
- If deeper runtime testing becomes important, we need a Pi test harness or a mock session/context factory.

### Known code issues found during testing

These were discovered while writing tests and are worth keeping visible because they
represent real behavioral quirks in production code.

1. **`damage-control/matcher.ts` — MUTATION_COMMAND_PATTERN regex false negatives.**
   Commands like `chmod 755 script.sh` do not match the mutation pattern. The regex
   `(^|\s)(chmod\s+)(\s|$)` requires the greedy `\s+` to leave whitespace for the
   trailing `(\s|$)` group, which only works with 2+ spaces between the command and
   its argument. Impact: some mutation commands against read-only/no-delete paths may
   pass through unchecked.

2. **`expert/helpers.ts` — Domain alias matching silently ignores short aliases.**
   `term_matches_prompt` rejects terms shorter than 3 characters. Aliases like `"db"`
   never match. This is intentional to avoid false positives but is not obvious to
   users defining aliases.

3. **`expert/helpers.ts` — Keyword-only matches fall below routing threshold.**
   A single keyword match scores +4, but `MIN_DOMAIN_MATCH_SCORE` is 6. A keyword
   alone is never sufficient to route a prompt to a domain.

4. **`expert/helpers.ts` — `scan_scope_paths` does not ignore top-level ignored directories.**
   `is_ignored_dir` only applies during recursive walk. If `"node_modules"` is passed
   directly as a scope path, its contents are returned. The ignore list is a convenience,
   not a security boundary.

---

## Priority Gaps

## P0 (next)

- None currently.

## P1

1. **Fix `MUTATION_COMMAND_PATTERN` regex** — the trailing `(\s|$)` group prevents single-space command matching. Consider removing it or restructuring the alternation. (See testing findings above.)

## P2

1. Enforce habitual use of `docs/specs/` + `docs/exec-plans/` for all medium/large initiatives (the `plan` skill now supports both; adoption still needs consistency).
2. Introduce component-level quality trend tracking over time (monthly snapshots).

---

## Definition of “Healthy” for This Repo

A healthy state means:

- New contributors can navigate from `AGENTS.md` → architecture docs → exact extension/skill docs quickly.
- Each extension directory has a practical README with triggers, setup, and behavior.
- New external resources can be added using a template with consistent metadata.
- Documentation and workflows consistently use Bun commands (`bun`, `bun run`, `bunx`).
- Known gaps are explicitly tracked here or in `.pi/todos`, not only in chat.
