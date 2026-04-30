# Pi lifecycle alignment and doc pruning

Status: Completed
Owner: pi
Created: 2026-04-14
Spec: [[docs/specs/2026-04-14-pi-lifecycle-alignment-and-doc-pruning]]

This ExecPlan is a living document and was maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Bring this repo's live extensions and active reference docs in line with current Pi lifecycle APIs, and remove package-level QMD guidance that is now handled by conditional extension-owned skill injection.

## Progress

- [x] (2026-04-14 10:40 UTC) Audited the repo for removed Pi lifecycle hooks and package-level QMD references.
- [x] (2026-04-14 10:48 UTC) Updated live extensions to stop using removed `session_switch` / `session_fork` hooks.
- [x] (2026-04-14 10:54 UTC) Updated extension READMEs, internal references, and stale planning docs to reflect `session_start`-based transitions.
- [x] (2026-04-14 11:02 UTC) Removed package-level/general-doc QMD guidance outside extension-local documentation.
- [x] (2026-04-14 11:10 UTC) Ran repository validation (`bun run test`, `bun run check`).

## Surprises & discoveries

- Observation: The most meaningful runtime risk was in QMD, where removed transition hooks were previously responsible for panel cleanup and freshness refresh.
  Evidence: `extensions/qmd/extension/runtime.ts` used `session_switch` for panel closing and state refresh.

- Observation: Most other lifecycle references were stale but low-risk because startup logic already ran through `session_start`.
  Evidence: `extensions/cmux/tab-title.ts` and `extensions/tracks/index.ts` already restored state on `session_start`.

- Observation: Package-level QMD guidance was broader than necessary and no longer matched actual conditional setup state.
  Evidence: `AGENTS.md` still directed agents to run `qmd query -c agents ...` even though the local collection was not guaranteed to exist.

## Decision log

- Decision: Use `session_start` + surviving within-session events (`session_tree`, `session_compact`) instead of trying to emulate removed hooks.
  Rationale: This matches upstream Pi semantics and avoids dead handlers.
  Date/Author: 2026-04-14 / pi

- Decision: Move QMD panel teardown to `session_shutdown`.
  Rationale: Session replacement now reloads extension instances, so teardown belongs on shutdown rather than removed post-transition hooks.
  Date/Author: 2026-04-14 / pi

- Decision: Remove QMD from package-level and general reference docs, but keep extension-local docs intact.
  Rationale: The extension remains supported, but global guidance should no longer assume QMD availability or manually instruct its use.
  Date/Author: 2026-04-14 / pi

## Outcomes & retrospective

Completed outcomes:
- Live extensions now follow supported Pi lifecycle hooks.
- QMD cleanup now happens on shutdown instead of removed transition hooks.
- General repo docs no longer instruct package-wide QMD usage.
- Active/stale internal docs now describe `session_start`-based transitions.

Remaining gaps:
- Historical QMD design docs remain in place for implementation history, which is intentional.

## Context and orientation

Key files updated:
- `extensions/cmux/tab-title.ts`
- `extensions/tracks/index.ts`
- `extensions/qmd/extension/runtime.ts`
- `extensions/qmd/extension/tool.ts`
- `AGENTS.md`
- `docs/references/pi-api-reference.md`
- `docs/references/conditional-feature-registration.md`
- `extensions/cmux/README.md`
- `extensions/qmd/README.md`
- `extensions/qmd/docs/architecture.md`
- `docs/specs/2026-03-07-session-stats-extension.md`
- `docs/exec-plans/active/2026-03-07-session-stats-extension.md`

## Plan of work

1. Identify all live code and current docs that still referenced removed Pi lifecycle events.
2. Replace transition logic with supported lifecycle hooks.
3. Update repo-level docs so they no longer prescribe QMD usage globally.
4. Re-run automated checks and keep the resulting spec/plan artifacts as the record of the migration.

## Concrete steps

All commands were run from `/Users/cgn/git/dev/0xcgn/agents`.

- Audit removed hooks and QMD references:
  - `rg -n "session_switch|session_fork|qmd query -c agents|extensions/qmd|QMD|qmd" .`
- Validate runtime behavior:
  - `bun run test`
  - `bun run check`

## Validation and acceptance

Success criteria:
- No live extension source depends on removed `session_switch` / `session_fork` hooks.
- QMD shutdown cleanup is attached to supported lifecycle events.
- General repo docs no longer contain package-level QMD usage guidance.
- Repo validation passes.

Observed validation:
- `bun run test` passed.
- `bun run check` passed.

## Idempotence and recovery

- Re-running the doc edits is safe because they are content substitutions, not migrations of persisted data.
- If lifecycle behavior regresses, inspect `session_start` and `session_shutdown` handlers first; removed transition hooks should not be reintroduced.

## Artifacts and notes

- Spec: [[docs/specs/2026-04-14-pi-lifecycle-alignment-and-doc-pruning]]
- Validation commands recorded above.

## Interfaces and dependencies

- Pi extension lifecycle API from `@mariozechner/pi-coding-agent`
- Shared conditional activation helper: `lib/extension-runtime/conditional-feature.ts`
- Repo validation entrypoint: `package.json` scripts (`check`, `test`)
