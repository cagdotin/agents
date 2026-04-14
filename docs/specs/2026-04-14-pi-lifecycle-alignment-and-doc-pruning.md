# Pi lifecycle alignment and doc pruning

Status: Completed
Date: 2026-04-14
Execution plan: [[docs/exec-plans/completed/2026-04-14-pi-lifecycle-alignment-and-doc-pruning]]

## 1. Problem statement

Recent Pi releases removed extension post-transition events such as `session_switch` and `session_fork` in favor of `session_start` with `event.reason`. This repository still contained runtime hooks and internal docs that referenced the removed events. The repo also still carried package-level QMD guidance in `AGENTS.md` and general reference docs even though QMD setup and skill injection are now handled conditionally by the extension itself.

## 2. Goals and non-goals

### 2.1 Goals
- Align repo extensions with the current Pi lifecycle model.
- Remove dead `session_switch` / `session_fork` hook usage from live extensions.
- Preserve intended transition behavior by moving teardown/refresh logic to supported lifecycle hooks.
- Remove package-level and general-doc QMD guidance that is now redundant with extension-owned auto-injection.
- Update stale internal docs so future extension work follows current Pi APIs.

### 2.2 Non-goals
- Removing the QMD extension itself.
- Rewriting extension-local QMD documentation that still serves as implementation documentation.
- Changing track/todo/QMD feature behavior beyond lifecycle compatibility and doc cleanup.

## 3. System context

Affected runtime surfaces:
- `extensions/cmux/tab-title.ts`
- `extensions/tracks/index.ts`
- `extensions/qmd/extension/runtime.ts`
- `extensions/qmd/extension/tool.ts`

Affected documentation surfaces:
- `AGENTS.md`
- `docs/references/pi-api-reference.md`
- `docs/references/conditional-feature-registration.md`
- `README.md`
- `docs/QUALITY.md`
- `docs/exec-plans/README.md`
- stale extension/planning docs that still name removed lifecycle hooks

## 4. Detailed design

### 4.1 Lifecycle migration
- Use `session_start` as the only post-transition session entrypoint for startup, reload, new-session, resume, and fork transitions.
- Keep within-session refresh logic on events that still exist (`session_tree`, `session_compact`).
- Move teardown that must run during session replacement to `session_shutdown`.

### 4.2 QMD runtime behavior
- QMD runtime bootstrap remains activation-driven through the conditional feature helper.
- The runtime should stop depending on removed transition hooks.
- Panel teardown should happen on `session_shutdown` so replacement of extension instances cannot leave stale panel state behind.

### 4.3 Documentation cleanup
- `AGENTS.md` should describe generic discovery practices without package-level QMD instructions.
- General Pi reference docs should stop using QMD as the standing example for conditional resources and search workflows.
- Historical/spec material may remain where it documents past work, but active reference docs should reflect the current guidance.

## 5. Error handling and failure modes

- Lifecycle migration should be behavior-preserving for startup and session replacement.
- QMD shutdown cleanup must remain safe when no panel is open.
- Doc cleanup must avoid breaking internal links or removing extension-specific implementation docs.

## 6. Testing strategy

### 6.1 Automated checks
- Run `bun run test`.
- Run `bun run check` after code and docs are updated.

### 6.2 Behavioral verification
- Confirm no live source files still reference removed `session_switch` / `session_fork` hooks.
- Confirm QMD runtime still exposes refresh behavior for `session_tree` / `session_compact` and closes state on shutdown.

## 7. Implementation checklist
- [x] Remove removed-session hook usage from live extensions.
- [x] Add supported shutdown cleanup for QMD runtime.
- [x] Update extension READMEs and internal reference docs to current lifecycle semantics.
- [x] Remove package-level QMD guidance from `AGENTS.md` and general docs.
- [x] Record the work in a spec and execution plan.
- [x] Validate with repo checks.

## 8. Open questions
- None.
