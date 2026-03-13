# Session Stats Extension — Implementation Plan

Status: Active
Owner: agent
Created: 2026-03-07
Spec: [[docs/specs/2026-03-07-session-stats-extension.md]]

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

This plan conforms to `skills/plan/PLAN.md`.

## Purpose / Big picture

After this work, a user can press `Ctrl+Alt+T` or type `/ss` in any Pi session to see a panel showing: how many tool calls were made (per-tool, with bar chart), error counts, turn/loop counts, model usage history, session duration, and other session activity metrics. Stats reflect the full session history, surviving extension reloads. A `◉` icon in the footer confirms the extension is loaded.

## Progress

- [x] (2026-03-07 15:00 CET) Milestone 1: Types, constants, tracker logic + tests — 23 tests pass
- [x] (2026-03-07 15:05 CET) Milestone 2: Panel TUI component
- [x] (2026-03-07 15:06 CET) Milestone 3: Extension entry (commands, shortcut, footer, session lifecycle)
- [x] (2026-03-07 15:07 CET) Milestone 4: README + validation — `bun run check` passes (340 tests, 0 errors)
- [ ] (2026-03-07 15:20 CET) Manual verification in a live Pi session

## Surprises & Discoveries

(none)

## Decision Log

- Decision: Separate extension instead of extending damage-control.
  Rationale: Single-responsibility. DC is about safety policy; observability is a different concern. DC panel is already complex (~400 lines).
  Date/Author: 2026-03-07 / user + agent

- Decision: Reconstruct stats on demand from session history, not in-memory event hooks.
  Rationale: In-memory counters reset on extension reload, losing all prior session activity. Session entries (`ctx.sessionManager.getBranch()`) contain the full history and are always available. Reconstruction is cheap (single pass over branch entries) and always accurate.
  Date/Author: 2026-03-07 / user + agent

- Decision: Defer skill tracking, tool timing, cost estimation, widget mode to phase 2.
  Rationale: Keep v1 focused. Cost is already in Pi footer. Skills require heuristic path matching. Timing and widget are nice-to-haves.
  Date/Author: 2026-03-07 / user + agent

## Outcomes & Retrospective

(to be filled on completion)

## Context and Orientation

### Repository structure

Extensions live in `extensions/`. Each is a self-contained directory with `index.ts` entry, README, types, and tests. All extensions follow the same structure; the closest pattern match for this work is `extensions/damage-control/` (panel + footer status).

### Pi Extension API (relevant subset)

- `ctx.sessionManager.getBranch()` — returns current branch of session entries (root to leaf)
- `ctx.model` — current model object (`id`, `name`, `provider`)
- `pi.on("session_start", handler)` — fires on initial session load
- `pi.on("session_switch", handler)` — fires after switching sessions
- `ctx.ui.setStatus(key, text)` — set footer status icon
- `ctx.ui.custom(factory, options)` — show overlay panel
- `pi.registerCommand(name, options)` — register `/command`
- `pi.registerShortcut(key, options)` — register keyboard shortcut

### Session entry types used for reconstruction

- `SessionMessageEntry` (type `"message"`) — contains `message.role` discriminator:
  - `"toolResult"` → `toolName`, `isError`
  - `"assistant"` → counts as a turn
  - `"user"` → counts as a prompt
  - `"bashExecution"` → counts as a user bash command
- `ModelChangeEntry` (type `"model_change"`) — `modelId`, `provider`
- `CompactionEntry` (type `"compaction"`) — compaction count

### Panel implementation pattern

Follows `extensions/damage-control/panel.ts`:
- Class implementing `handleInput(key_data)`, `render(width): string[]`, `invalidate()`
- `frame_content()` helper for border drawing
- `matchesKey()` from `@mariozechner/pi-tui` for key handling
- `truncateToWidth()`, `visibleWidth()` for layout

## Plan of Work

### Milestone 1: Types, constants, tracker logic + tests

1. Create `extensions/session-stats/types.ts` with `ToolTally`, `ModelUsageEntry`, `SessionStats` types.
2. Create `extensions/session-stats/constants.ts` with status key, icon, command names, shortcut key.
3. Create `extensions/session-stats/tracker.ts` with `reconstruct_stats()` and utility functions.
4. Create `extensions/session-stats/__tests__/tracker.test.ts` with synthetic session entry tests.
5. Run tests: `bun test extensions/session-stats`.

### Milestone 2: Panel TUI component

1. Create `extensions/session-stats/panel.ts` with `SessionStatsPanel` class.
2. Layout sections: header with duration, summary row (turns/loops/compactions/prompts), tool call bar chart, model history, footer hints.
3. Support scrolling for overflow, `r` to refresh (re-reconstruct), `esc`/`q` to close.
4. Build plain-text fallback for non-UI mode.

### Milestone 3: Extension entry (commands, shortcut, footer)

1. Create `extensions/session-stats/index.ts`:
   - `build_stats(ctx)` helper that calls `reconstruct_stats()` from `ctx.sessionManager.getBranch()`.
   - Register `/session-stats` command (alias `/ss`).
   - Register `Ctrl+Alt+T` shortcut.
   - `session_start`/`session_switch` hooks: close panel if open, set footer status.
   - Panel `get_stats` callback calls `build_stats(ctx)` for fresh reconstruction on each open/refresh.
2. Wire panel open/toggle logic (same pattern as damage-control).

### Milestone 4: README + validation + manual test

1. Write `extensions/session-stats/README.md`.
2. Run `bun run check` — fix biome/docs issues.
3. Manual test in a live Pi session: verify footer icon, open panel, check stats reflect full session history.

## Concrete Steps

All commands run from repository root: `/Users/cgn/git/0xcgn/agents`

### Milestone 1

```bash
mkdir -p extensions/session-stats/__tests__
# Create types.ts, constants.ts, tracker.ts, tracker.test.ts
bun test extensions/session-stats
```

### Milestone 2–3

```bash
# Create panel.ts, index.ts
```

### Milestone 4

```bash
# Create README.md
bun run check
# Manual: open /ss panel, verify full session history is reflected
```

## Validation and Acceptance

1. `bun test extensions/session-stats` — all 23 tracker tests pass.
2. `bun run check` — no biome or docs validation errors (340 tests total).
3. Manual: in a Pi session with prior activity, open `/ss` panel. Verify:
   - Footer shows `◉` icon in accent color.
   - Panel shows correct tool call counts for the full session (including pre-reload activity).
   - Turn and agent loop counts are reasonable.
   - Model section shows current model.
   - Duration reflects time since session start, not extension load.
   - `r` refreshes with latest data, `esc` closes.

## Idempotence and Recovery

All changes are additive (new directory). Safe to re-run any step. No existing code is modified.

## Artifacts and Notes

(to be filled during implementation)

## Interfaces and Dependencies

### Required imports from Pi

```ts
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

import {
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
```

### Session manager API used

- `ctx.sessionManager.getBranch()` — returns `SessionEntry[]` for the current branch
- `ctx.model` — current model object with `id`, `name`, `provider`
