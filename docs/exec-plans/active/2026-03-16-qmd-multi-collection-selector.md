# QMD multi-collection selector rollout

Status: Active  
Owner: agent  
Created: 2026-03-16  
Spec: [[docs/specs/2026-03-16-qmd-multi-collection-selector]]

This ExecPlan is a living document and conforms to `skills/plan/PLAN.md`.
Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as implementation proceeds.

## Purpose / Big picture

After this rollout, `/qmd` remains repo-first by default, but users can open a selector view and switch the panel to any collection in the QMD store. They can inspect those collections without leaving Pi’s TUI.

User-visible success criteria:
- Opening `/qmd` in a repo with binding still starts on that repo’s collection.
- A selector view can be opened (keyboard) and used to switch active collection.
- Overview and files/detail sections update to the selected collection.
- External selections are read-only in this phase; existing write/update semantics remain safe and unsurprising.

## Progress

- [x] (2026-03-16 11:27 CET) Planning artifacts created (spec + this exec plan).
- [x] (2026-03-16 11:31 CET) Extended `QmdPanelSnapshot` with collection catalog, selection scope, capability flags, and selected-key fallback logic.
- [x] (2026-03-16 11:34 CET) Added `collections` panel view with `c` navigation flow and in-panel collection switching.
- [x] (2026-03-16 11:37 CET) Implemented external-selection readonly behavior (`[readonly]` tags, disabled update/toggle actions).
- [x] (2026-03-16 11:39 CET) Updated plain-text summary + panel docs + extension README for selector/readonly UX.
- [x] (2026-03-16 11:44 CET) Updated tests and passed full quality gate (`bun run check`).
- [x] (2026-03-16 11:49 CET) UX polish pass: added collections quick filter (`/`), selection scope strip, and stronger selector view grouping/hints.
- [x] (2026-03-16 12:05 CET) Minimal-density layout pass: simplified collection rows, moved metadata into a dedicated details block, and preserved generous spacing/readability.
- [x] (2026-03-16 12:09 CET) Typography rhythm micro-pass: softened collections separators, shortened hint copy, and tightened token spacing in selection strips/tags.

## Surprises & Discoveries

- Observation: Current panel already combines overview/files/updating/applying in one class (`ui/panel.ts`), so selector additions can be done incrementally without new wiring files.
  Evidence: Existing `PanelView` union and view-specific handlers in `extensions/qmd/ui/panel.ts`.

- Observation: File toggling currently depends on filesystem scans of the bound repo and marker-managed dot-path handling; this does not safely generalize to arbitrary external collections.
  Evidence: `on_toggle_files` and dot-path persistence flow in `extensions/qmd/extension/command.ts`.

- Observation: Running a single test file with `bun test` fails for vitest-style mocks (`vi.importActual`), while `bun run test -- <path>` works reliably.
  Evidence: local run error with `vi.importActual is not a function`; same test passes via `vitest run` through `bun run test`.

- Observation: `close_panel` in `extension/command.ts` was never wired to the live panel close callback, which weakened panel lifecycle controls from runtime events.
  Evidence: `close_panel` remained `null` until explicit callback wiring was added.

## Decision Log

- Decision: Phase 1 keeps external collection interactions read-only.
  Rationale: Preserves `/qmd update` and file-toggle safety invariants while delivering the requested cross-collection navigation.
  Date/Author: 2026-03-16 / agent

- Decision: Selector state is panel-session local and defaults to bound collection on open.
  Rationale: Matches least-surprise requirement and avoids persistence policy complexity.
  Date/Author: 2026-03-16 / agent

- Decision: Enforce mutability through snapshot capability flags (`supports_update_action`, `supports_file_toggling`) and render explicit `[readonly]` tags for external selections.
  Rationale: Keeps policy in data, avoids scattered branch logic, and makes readonly mode visible at the interaction boundary.
  Date/Author: 2026-03-16 / agent

## Outcomes & Retrospective

Implemented and validated.

Delivered outcomes:
- QMD panel now supports in-panel collection switching (`c` -> collections view -> `enter` to select).
- `/qmd` still defaults to current repo binding when available.
- External selections are visibly readonly (`[readonly]` tags) with update/toggle actions disabled.
- Files view adapts source semantics: filesystem tree for bound selection, indexed QMD-path tree for external selection.
- Plain-text fallback now reports selected vs bound collection and readonly mode.
- Panel lifecycle close handling was hardened by wiring a real `close_panel` callback.
- Collections selector now supports quick filtering (`/` typing mode with clear/reset controls) and displays an explicit selection scope strip for faster orientation.
- Collections view was refined to a lower-density visual hierarchy: concise list rows (key + tags) with a dedicated selection-details block for docs/pattern/path.

Validation completed:
- `bun run test -- extensions/qmd/__tests__/ui/data.test.ts`
- `bun run test -- extensions/qmd`
- `bun run check`

Remaining work:
- Optional future phase: explicit confirmed write actions for external collections (not part of this phase).

## Context and orientation

Primary implementation files:
- `extensions/qmd/ui/data.ts` — snapshot contract and data shaping (first implementation boundary).
- `extensions/qmd/ui/panel.ts` — TUI views and key handling.
- `extensions/qmd/ui/plain-text.ts` — non-TUI status surface.
- `extensions/qmd/extension/command.ts` — callback wiring and mutation policy.
- `extensions/qmd/core/qmd-store.ts` — collection/status/path primitives from SDK.

Critical invariants to preserve:
- QMD store is source of truth for collections and contexts.
- `.pi/qmd.json` remains current-repo marker only.
- `/qmd update` command behavior remains current-repo scoped.

## Plan of work

### Milestone 1 — snapshot contract and selection fallback

Extend `QmdPanelSnapshot` so one snapshot can drive both repo-local and cross-collection UX.

Implementation goals:
- introduce collection catalog and selected-detail blocks.
- deterministic selection fallback: explicit -> bound -> first -> none.
- add capability flags (`supports_file_toggling`, `supports_update_action`) so panel behavior is data-driven.

### Milestone 2 — selector view and keyboard flow

Add `collections` view to panel with lightweight navigation and selection.

Implementation goals:
- key `c` opens selector from overview/files.
- `j/k`, `g/G`, `PageUp/Down`, `enter`, `esc` behave consistently with existing panel UX.
- header/footer hints adapt based on selected scope.

### Milestone 3 — external details mode

Support detail browsing for external collections without write operations.

Implementation goals:
- keep bound collection files mode unchanged.
- for external selection, render indexed-path tree/list read-only.
- disable/remove write hints (`space`, `a`, `u`) when unsupported.

### Milestone 4 — fallback output, docs, tests

Finalize all user surfaces and regression coverage.

Implementation goals:
- update plain-text summary output.
- update `extensions/qmd/docs/panel.md` and `extensions/qmd/README.md`.
- update/add tests in `extensions/qmd/__tests__/ui/data.test.ts` (+ panel helper tests if extracted).
- run `bun run check`.

## Concrete steps

Run from repo root (`/Users/cgn/git/0xcgn/agents`):

```bash
# 1) Focused tests while iterating
bun run test -- extensions/qmd/__tests__/ui/data.test.ts

# 2) Extension-level test sweep
bun run test -- extensions/qmd

# 3) Full quality gate
bun run check
```

Manual verification in Pi:
1. `/qmd` -> opens on bound collection.
2. `c` -> selector opens.
3. choose another collection with `enter`.
4. verify overview updates and indicates external read-only mode.
5. open files/details and confirm no toggle/apply actions for external selection.
6. return to bound collection and verify `u`/toggle actions are available again.

## Validation and acceptance

Acceptance criteria:
- Default selection is bound collection when available.
- User can switch collections inside panel and inspect details.
- External selection cannot mutate indexes in phase 1.
- Existing repo-local update/toggle behavior still works unchanged.
- `bun run check` passes.

## Idempotence and recovery

- Safe rollback path: revert `ui/data.ts`, `ui/panel.ts`, `ui/plain-text.ts`, `extension/command.ts`, and associated tests/docs.
- If selector logic fails at runtime, panel should still render bound overview as fallback (or unavailable state), not crash session.
- Selection fallback logic must be deterministic, so refresh/reopen always yields a valid state.

## Artifacts and notes

- Spec: `docs/specs/2026-03-16-qmd-multi-collection-selector.md`
- This plan: `docs/exec-plans/active/2026-03-16-qmd-multi-collection-selector.md`

## Interfaces and dependencies

Planned interface changes:
- `build_qmd_panel_snapshot(..., selected_collection_key?)` signature extension.
- `QmdPanelSnapshot` expanded with catalog + selected detail/capability fields.
- `QmdPanel` view union expanded to include `collections`.

Dependencies used:
- Existing `qmd-store` helpers (`get_status`, `list_contexts`, `get_active_document_paths`, `scan_filesystem_paths`).
- Existing repo-binding and freshness flow for bound collection defaults.
- Existing panel framing/scrolling interaction patterns from `ui/panel.ts`.
