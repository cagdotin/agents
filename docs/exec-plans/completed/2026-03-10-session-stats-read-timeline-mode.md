# Session Stats — File Operation Timeline Mode

Status: Complete
Owner: agent
Created: 2026-03-10
Spec: [[docs/specs/2026-03-10-session-stats-read-timeline-mode.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/plan/PLAN.md`.

## Purpose / Big picture

Add a timeline mode to `Session Stats` detail views for Read, Edit, and Write so users can see user-message boundaries and file operation order with timestamps. After this change, users can verify prompt-to-operation sequencing directly in the TUI without reading raw session logs.

## Progress

- [x] (2026-03-10 16:35 CET) Discovery completed: reviewed current `session-stats` tracker + panel behavior and existing phase-2 docs.
- [x] (2026-03-10 16:42 CET) Created draft spec for timeline mode and UX interaction model.
- [x] (2026-03-10 16:45 CET) Aligned defaults with user: oldest-first, repeated rows with ↺, t/1/2 keybindings.
- [x] (2026-03-10 16:48 CET) Implemented tracker model changes: `FileTimelineEvent` type, per-tool timeline arrays in `ToolDetails`, emission in `reconstruct_stats()`.
- [x] (2026-03-10 16:49 CET) Added timeline-specific unit tests for Read — 83 total, all pass.
- [x] (2026-03-10 16:50 CET) Implemented panel timeline mode: unified `detail_file_tool` renderer for Read/Edit/Write, rail renderer with timestamps/order/category/repeat, `t/1/2` keybindings.
- [x] (2026-03-10 16:51 CET) Fixed biome formatting and unused imports.
- [x] (2026-03-10 16:52 CET) Updated README + ran `bun run check` — 411 tests pass, 0 errors.
- [x] (2026-03-10 17:30 CET) Scope broadened from Read-only to Read/Edit/Write: added Edit and Write timeline tests, plain-text summary tests, extracted `append_plain_text_timeline` helper, consolidated duplicate import, updated spec and exec plan.

## Surprises & discoveries

- Current implementation stores `read_files`/`edit_files`/`write_files` as unique paths only; they do not retain event sequence or timestamps, so timeline support requires additive event tracking rather than panel-only changes.
- Detail view is a full-screen tool drill-down, not a split-column layout. Timeline mode fits this existing interaction pattern.
- The Read, Edit, and Write detail renderers had diverged (Read had categories, Edit/Write had flat lists). The timeline feature was the right moment to unify them into a shared `detail_file_tool` method with a shared `render_file_categories`/`render_file_timeline` pair.
- Plain-text timeline rendering had near-identical blocks for all three tools — extracted into `append_plain_text_timeline` helper during review cleanup.

## Decision log

- Decision: Keep existing categories mode as the default and add timeline as a toggle.
  Rationale: Maintains current at-a-glance context coverage while adding sequencing depth only when requested.
  Date/Author: 2026-03-10 / agent

- Decision: Use lightweight user markers only (`● user message`) without content snippets.
  Rationale: Matches user requirement and keeps privacy/noise boundaries clear.
  Date/Author: 2026-03-10 / user + agent

- Decision: Additive data model (`*_timeline_events`) instead of replacing unique file lists.
  Rationale: Preserves existing behavior and avoids regressions in categories mode/plain summaries.
  Date/Author: 2026-03-10 / agent

- Decision: Broaden scope from Read-only to Read/Edit/Write in a single change.
  Rationale: The event model (`FileTimelineEvent`), tracker infrastructure (`TimelineTracker`), and panel rendering are identical across all three tools. Shipping Read-only would have meant duplicating the same generalization work later. The spec's open question #3 anticipated this as the natural next step.
  Date/Author: 2026-03-10 / user + agent

- Decision: Independent per-tool timelines with independent `op_order` counters (not a cross-tool unified timeline).
  Rationale: Keeps each tool's detail view self-contained. A unified timeline would require a different navigation model and is a separate feature.
  Date/Author: 2026-03-10 / agent

## Outcomes & retrospective

Implementation complete. All changes are additive — no existing behavior modified.

- Timeline tests: 18 tests across Read/Edit/Write timeline extraction + 5 plain-text summary tests (97 total in extension)
- Files modified: `types.ts`, `tracker.ts`, `panel.ts`, `__tests__/tracker.test.ts`, `README.md`
- `bun run check` clean
- Awaiting manual verification in live Pi session

Gap flagged during review: panel keybinding/render tests (t/1/2 mode switching, footer hints) would require mock TUI infrastructure that doesn't exist yet. Acceptable risk for now; flagged for future investment.

## Context and orientation

Relevant files:
- `extensions/session-stats/tracker.ts`: reconstructs stats from `ctx.sessionManager.getBranch()` entries.
- `extensions/session-stats/types.ts`: `ToolDetails` and `SessionStats` shapes.
- `extensions/session-stats/panel.ts`: list/detail rendering and key handling.
- `extensions/session-stats/__tests__/tracker.test.ts`: current coverage for extraction/categorization.
- `extensions/session-stats/README.md`: user-facing behavior docs.

## Plan of work

1. Extend tracker domain model to capture file-op timeline events and user markers for Read/Edit/Write while preserving existing aggregates.
2. Add tests that verify chronological ordering, marker insertion, repeat detection, and per-tool independence.
3. Unify Read/Edit/Write detail rendering via shared `detail_file_tool` with mode toggle (`categories` / `timeline`).
4. Add plain-text timeline helper and tests.
5. Update README to reflect new interaction and semantics.
6. Validate with tests and check suite.

## Concrete steps

Working directory: `/Users/cgn/git/0xcgn/agents`

1. Edit `extensions/session-stats/types.ts`
   - add `FileTimelineEvent` discriminated union
   - add `read_timeline_events`, `edit_timeline_events`, `write_timeline_events` to `ToolDetails`
2. Edit `extensions/session-stats/tracker.ts`
   - add `TimelineTracker` infrastructure
   - collect user-marker and file-op events for all three tools in `reconstruct_stats()`
   - keep unique file list behavior unchanged
3. Edit `extensions/session-stats/__tests__/tracker.test.ts`
   - add timeline-focused unit tests for Read, Edit, Write
   - add `build_plain_text_summary` timeline tests
4. Edit `extensions/session-stats/panel.ts`
   - unify Read/Edit/Write detail via `detail_file_tool`
   - add mode switch state + key handling
   - add timeline renderer and legend
   - extract `append_plain_text_timeline` helper for plain-text output
5. Edit `extensions/session-stats/README.md`
   - document timeline mode and keys for all three tools
6. Run:
   - `bun test extensions/session-stats`
   - `bun run check`

## Validation and acceptance

Acceptance checks:
- Read, Edit, and Write detail views support mode toggle between categories and timeline.
- Timeline shows user markers and file-op events in consistent chronological order.
- Each file-op row shows timestamp + order index + path + category marker.
- Per-tool `op_order` is independent (Read #1, Edit #1, etc.).
- Repeated operations are visually identifiable with `↺`.
- Plain-text summary includes timeline sections with truncation.
- Existing summary/list behaviors remain unchanged.
- Test suite passes and no lint/docs check regressions.

## Idempotence and recovery

- Changes are additive to `ToolDetails`; existing fields are untouched.
- If panel UX is unsatisfactory, tracker changes can remain while feature flagging/toggling timeline render path.
- Safe rollback: remove new field usage from panel; tests will guard model consistency.

## Artifacts and notes

- Spec: `docs/specs/2026-03-10-session-stats-read-timeline-mode.md`

## Interfaces and dependencies

No new external dependencies.

Expected interfaces used:
- Existing session entry traversal in `reconstruct_stats()`
- Existing `categorize_file(path)` helper
- Existing TUI key matching/render helpers in `panel.ts`
