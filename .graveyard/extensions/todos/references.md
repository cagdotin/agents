# Todos Extension — References at Time of Removal

Collected 2026-04-14. Documents what referenced the todos extension across the repo.

---

## Live docs (require cleanup)

### `docs/ARCHITECTURE.md`
- Line 65: `.pi/todos/` listed under `.pi/` runtime state

### `docs/QUALITY.md`
- Line 25: `extensions/todos` rated 3/Good
- Line 40: mentions `todos/tool.ts` as candidate for more test coverage
- Line 69: mentions `.pi/todos` as a place to track known gaps

### `docs/CONTRIBUTING-DOCS.md`
- Lines 65-66: uses `helpers.ts` in the todos extension as a do/don't example for doc references
- Line 86: mentions `.pi/todos/` for actionable items

### `docs/references/pi-api-reference.md`
- Line 144: `extensions/todos` as example of tool result rendering
- Line 181: `extensions/todos/` as "tool + command + TUI flow" reference pattern

### `AGENTS.md`
- No direct todos references (already cleaned in prior session)

### `README.md`
- No direct todos references (extension listing already removed)

### `skills/plan/SKILL.md`
- Line 24: mentions "todos context" in self-discovery principle

---

## Completed specs and exec-plans (leave as historical record)

### `docs/specs/2026-03-07-vitest-testing-infrastructure.md`
- Lines 58-60: todos modules listed as test candidates with line counts
- Lines 73-75: mock strategies for todos dependencies
- Lines 330-356: full test plan for helpers.test.ts and storage.test.ts
- Lines 481-490: completed test checklist entries

### `docs/specs/2026-03-07-zod-hybrid-validation-integration.md`
- Lines 31, 49, 54, 119, 127, 173, 194: todos/storage.ts and todos/types.ts as Zod integration targets

### `docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- Line 51: explicitly notes no integration with `.pi/todos/`

### `docs/specs/2026-03-13-qmd-tui-panel.md`
- Line 178: mentions `.pi/` containing todos in a directory listing example

### `docs/exec-plans/completed/2026-03-07-zod-hybrid-validation-integration.md`
- Multiple references to todos as a Zod migration target (milestones, evidence, file lists)

### `docs/exec-plans/completed/2026-03-06-harness-alignment-plan.md`
- Line 99: mentions rewriting todos README
- Line 164: `.pi/todos` listed as expert TODOs location

### `docs/exec-plans/completed/2026-03-11-tracks-extension-minimal-v1.md`
- Line 33: discovery excluded `.pi/todos/` coupling
- Line 48: user rejected using todos as implementation reference for tracks

### `docs/exec-plans/completed/2026-03-11-tmux-extension-merge.md`
- Line 47: `extensions/todos/index.ts` cited as gold-standard extension pattern
