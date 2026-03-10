# QUALITY

Status: active  
Last updated: 2026-03-10

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
| `extensions/session-stats` | 3 | Good | In-session observability panel with tool call charts, detail drill-downs, file timeline mode, and model history; 97 unit tests |
| `extensions/tmux-notify` | 3 | Good | Useful and focused; now documented |
| `extensions/tmux-pane-title` | 3 | Good | Useful and focused; now documented |
| Skills (`skills/*`) | 3 | Good | Consistent SKILL format and clear purpose |
| Mechanical validation | 4 | Excellent | `bun run check` gates Biome + docs validation + Vitest; Lefthook pre-commit runs all three in parallel |
| Automated testing | 3 | Good | 425 unit tests across 15 files covering Tier 1 (pure logic) and Tier 2 (mocked Pi imports); no LLM calls in tests; Tier 3 (runtime integration) deferred |

---

## Testing Infrastructure

Vitest is the test runner, invoked via `bun run test`. Tests live in `__tests__/` directories co-located with each extension. Shared mocks for `@mariozechner/*` peer dependencies live in `extensions/__mocks__/` and are resolved via Vitest aliases — no real Pi runtime or LLM calls are ever made.

**Coverage baseline (2026-03-10):** 425 tests, 15 files, ~1s.

### Known Code Issues Found During Testing

These were discovered while writing the initial test suite. They are documented here as they represent real behavioral quirks in the production code.

1. **`damage-control/matcher.ts` — MUTATION_COMMAND_PATTERN regex false negatives.**
   Commands like `chmod 755 script.sh` do NOT match the mutation pattern. The regex `(^|\s)(chmod\s+)(\s|$)` requires the greedy `\s+` to leave whitespace for the trailing `(\s|$)` group, which only works with 2+ spaces between the command and its argument. Affects all command patterns in the alternation (`chmod`, `chown`, `cp`, `mv`, `mkdir`, `touch`, `tee`, `truncate`). Only redirect operators (`>`, `>>`) and `install -` reliably match. Impact: some mutation commands against read-only/no-delete paths may pass through unchecked.

2. **`expert/helpers.ts` — Domain alias matching silently ignores short aliases.**
   `term_matches_prompt` rejects terms shorter than 3 characters. Aliases like `"db"` (2 chars) never match. This is intentional to avoid false positives but is not documented — users defining aliases should be aware of the minimum length.

3. **`expert/helpers.ts` — Keyword-only matches fall below routing threshold.**
   A single keyword match scores +4, but `MIN_DOMAIN_MATCH_SCORE` is 6. A keyword alone is never sufficient to route a prompt to a domain — it must combine with another signal (description word, scope path, etc.). This may surprise users who expect keywords to be first-class routing signals.

4. **`expert/helpers.ts` — `scan_scope_paths` does not ignore top-level ignored directories.**
   `is_ignored_dir` only applies to subdirectories encountered during recursive walk. If `"node_modules"` is passed directly as a scope path, its contents are returned. The ignore list is a convenience for walking parent directories, not a security boundary.

---

## Priority Gaps

## P0 (next)

- None currently.

## P1

1. **Fix MUTATION_COMMAND_PATTERN regex** — the trailing `(\s|$)` group prevents single-space command matching. Consider removing it or restructuring the alternation. (See testing findings above.)

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
