# QMD TUI Panel — Execution Plan

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

Conforms to: `skills/plan/PLAN.md`
Spec: `docs/specs/2026-03-13-qmd-tui-panel.md`
Track: agent-memory

## Purpose / Big picture

After this work, a user can press `Ctrl+Alt+Q` (or type `/qmd` or `/qp`) and see a full dashboard of their repo's QMD index — binding status, freshness, document count, path contexts, stale files — in an interactive TUI panel. They can press `u` to update the index without leaving the panel, `enter` to browse all indexed files, or `i` to start onboarding if the repo isn't indexed yet.

**How to verify:** Open pi in this repo, press `Ctrl+Alt+Q`. The panel opens showing "indexed ✓", collection key, document count, contexts, and freshness. Press `u`, see progress, panel refreshes with "fresh ✓". Press `enter`, see grouped file listing. Press `esc`, back to overview. Press `q`, panel closes.

## Context and orientation

### What exists

The QMD extension (`extensions/qmd/`) has three layers:
- `core/` — SDK wrapper (`qmd-store.ts`), types (`types.ts`), errors (`errors.ts`)
- `domain/` — repo binding (`repo-binding.ts`), freshness (`freshness.ts`), onboarding (`onboarding.ts`)
- `extension/` — Pi wiring: runtime hooks (`runtime.ts`), commands (`command.ts`), init tool (`tool.ts`)

The extension already caches `last_binding` and `last_freshness` in its state object (`QmdExtensionState`), refreshes them on session events, and shows a footer status line.

### What we're adding

A `ui/` directory inside `extensions/qmd/` containing:
- `constants.ts` — panel constants (width, shortcut, command names)
- `data.ts` — snapshot builder (pure data, depends only on `core/types.ts` and `core/qmd-store.ts`)
- `panel.ts` — TUI panel class (depends on `ui/data.ts`, `ui/constants.ts`, `@mariozechner/pi-tui`)
- `plain-text.ts` — plain-text fallback builder (depends on `ui/data.ts`)

And modifications to:
- `extension/command.ts` — register panel command, alias, shortcut
- `core/qmd-store.ts` — add `get_active_document_paths()` and `get_index_health()`
- `index.ts` — wire panel state into lifecycle
- `README.md` — document panel

### Reference pattern

`extensions/session-stats/` is the primary reference:
- `panel.ts` — the `SessionStatsPanel` class with list/detail views, scrolling, framing
- `index.ts` — open/toggle pattern, command + alias + shortcut registration
- `tracker.ts` — pure data reconstruction from session history
- `constants.ts` — all magic strings and numbers in one place

The QMD panel follows the same structure, adapted for QMD's domain data.

### Dependency direction rule

```
extension/command.ts → ui/panel.ts → ui/data.ts → core/types.ts
                                                  → core/qmd-store.ts
                     → ui/plain-text.ts → ui/data.ts
                     → ui/constants.ts
```

No upward imports. `ui/` never imports from `extension/`. `ui/data.ts` never imports from `@mariozechner/pi-tui`.

## Plan of work

### Milestone 1: Store additions + constants

**Goal**: Expose the SDK data needed by the panel and establish panel constants.

**Work**:

1. Add to `core/qmd-store.ts`:
   - `get_active_document_paths(collection_key: string): Promise<string[]>` — wraps `store.getActiveDocumentPaths(collection_key)`
   - `get_index_health(): Promise<{ needs_embedding: number; total_docs: number; days_stale: number | null }>` — wraps `store.getIndexHealth()`

2. Create `ui/constants.ts`:
   - `QMD_PANEL_COMMAND = "qmd"` (reuses existing `/qmd` — panel becomes the default when no subcommand)
   - `QMD_PANEL_ALIAS = "qp"`
   - `QMD_PANEL_SHORTCUT = "ctrl+alt+q"`
   - `QMD_PANEL_ICON = "◈"`
   - `QMD_PANEL_WIDTH = 80`

**Validation**: `bun run check` passes. Store helpers return plausible data when called manually.

### Milestone 2: Data snapshot layer

**Goal**: A pure function that gathers all QMD state into a flat, typed snapshot.

**Work**:

1. Create `ui/data.ts`:
   - Define `QmdPanelSnapshot` interface (flat, serializable struct — all fields documented in spec §4)
   - Implement `build_qmd_panel_snapshot(cwd, binding, freshness)`:
     - If indexed: call `get_status()`, `list_contexts()`, `get_active_document_paths()` from store
     - If not indexed: return minimal snapshot with repo root and suggested key
     - If unavailable: return snapshot with error reason
     - All store errors caught and mapped to unavailable status
   - Implement helper: `format_relative_time(iso_string)` → `"2h ago"`, `"3d ago"`, etc.
   - Implement helper: `group_paths_by_directory(paths)` → `Map<string, string[]>` (for file detail view)

2. Create `__tests__/ui/data.test.ts`:
   - Mock `core/qmd-store.ts` calls
   - Test: indexed + fresh → full snapshot
   - Test: indexed + stale → stale_paths populated
   - Test: not indexed → correct minimal snapshot
   - Test: unavailable → error reason
   - Test: `group_paths_by_directory` logic
   - Test: `format_relative_time` edge cases

**Validation**: `bun test extensions/qmd/__tests__/ui/data.test.ts` — all pass.

### Milestone 3: Plain-text fallback

**Goal**: Non-TUI environments get a useful text summary.

**Work**:

1. Create `ui/plain-text.ts`:
   - `build_plain_text_summary(snapshot: QmdPanelSnapshot): string`
   - Mirrors the panel overview in text: binding, freshness, stats, contexts, stale files
   - No ANSI codes, no TUI imports

**Validation**: Call `build_plain_text_summary()` with test snapshots, verify readable output.

### Milestone 4: Panel — overview rendering

**Goal**: The main panel view renders the overview sections.

**Work**:

1. Create `ui/panel.ts` with `QmdPanel` class:
   - Constructor takes `tui`, `theme`, `QmdPanelCallbacks` (see spec §4), `done` callback
   - Implements `render(width): string[]`, `handleInput(data): void`, `invalidate(): void`
   - Reuse the framing pattern from `SessionStatsPanel`: `╭─╮ │ │ ╰─╯`, `pad_to_width`, `truncateToWidth`
   - Render sections:
     - **Header**: icon + "QMD Index" + status badge
     - **Summary line**: collection key · glob · doc count · freshness
     - **Timestamp line**: last indexed relative time · commit short hash
     - **Index section**: documents, vector index, needs embed
     - **Contexts section**: path contexts list with annotations (selectable with `▸`)
     - **Stale section**: changed paths (only if stale, with "u to update" hint)
   - **Footer**: contextual key hints

2. Panel states (from spec §7):
   - Indexed (fresh/stale/unknown) — full dashboard
   - Not indexed — repo root + suggested key + `i` hint
   - Unavailable — error message
   - Updating — progress (milestone 6)

3. Scroll handling:
   - `scroll_offset`, `scroll_view_height` for content area
   - Same approach as `SessionStatsPanel`

**Validation**: Panel renders in an overlay without crashes. Manual check: open panel, verify all sections visible, scroll works.

### Milestone 5: Panel — detail view + keyboard interactions

**Goal**: File browser detail view and all keyboard shortcuts.

**Work**:

1. Add detail view to `QmdPanel`:
   - Triggered by `enter`/`l`/`→` from overview
   - Header shows breadcrumb: `◈ QMD Index › Files` + total count
   - Body shows files grouped by top-level directory using `group_paths_by_directory()`
   - Each group: directory name + count, then indented file paths
   - Scroll support with position indicator in footer

2. Wire all keyboard shortcuts (spec §6):
   - `q`/`esc` — close (overview) or back (detail)
   - `Ctrl+Alt+Q` — toggle
   - `r` — refresh (rebuild snapshot via `get_snapshot()`)
   - `j/k`/`↑↓` — scroll
   - `enter`/`l`/`→` — detail view
   - `h`/`←` — back from detail
   - `g`/`G` — top/bottom
   - `PageUp/Down` — page scroll

**Validation**: Navigate overview → detail → back. Scroll in both views. All shortcuts work.

### Milestone 6: Update action + progress

**Goal**: `u` key triggers a real `/qmd update` and shows progress in the panel.

**Work**:

1. Add updating state to `QmdPanel`:
   - When `u` is pressed, set `view = "updating"`, call `on_update()` callback
   - Show progress via `update_collection()` `on_progress` callback (if wired)
   - On completion, rebuild snapshot and return to overview
   - On failure, notify error, restore previous view

2. Wire `on_update` in `extension/command.ts`:
   - Reuses existing update logic from `/qmd update` command handler
   - After update completes, rebuild snapshot

3. Add `i` key handler:
   - Only available when `binding_status === "not_indexed"`
   - Closes the panel, triggers `/qmd init` flow

**Validation**: Press `u` in panel, see update run, panel refreshes showing "fresh ✓".

### Milestone 7: Command + shortcut registration

**Goal**: Panel is accessible via `/qmd`, `/qp`, and `Ctrl+Alt+Q`.

**Work**:

1. Modify `extension/command.ts`:
   - When `/qmd` is called with no args (currently defaults to "status"), open the panel instead
   - Keep `/qmd status`, `/qmd update`, `/qmd init` subcommands working as before
   - Add `pi.registerCommand("qp", ...)` alias
   - Add `pi.registerShortcut("ctrl+alt+q", ...)` for toggle

2. Modify `index.ts`:
   - Track panel open/close state (same pattern as session-stats)
   - Close panel on `session_start` and `session_switch`

3. Panel toggle logic:
   - If panel is open and shortcut/command fires, close it
   - If `ctx.hasUI` is false, print plain-text summary

**Validation**: `/qmd` opens panel. `/qmd status` still prints text. `/qp` opens panel. `Ctrl+Alt+Q` toggles.

### Milestone 8: Documentation + quality pass

**Goal**: Panel behavior is documented, extension README updated, code passes all checks.

**Work**:

1. Create `docs/panel.md`:
   - What the panel shows
   - Keyboard shortcuts table
   - Panel states
   - How data flows (snapshot → render)

2. Update `README.md`:
   - Add panel section
   - Document `/qp` alias and `Ctrl+Alt+Q` shortcut
   - Note: `/qmd` with no args opens panel, subcommands still work

3. Quality pass:
   - `bun run check` passes
   - No circular imports between `ui/` and `extension/`
   - Panel degrades gracefully when store is unavailable
   - All new files follow naming conventions (kebab-case files, snake_case functions, CamelCase types)

**Validation**: `bun run check` passes. README documents all new behavior. `docs/panel.md` exists.

## Concrete steps

All commands are run from the repo root: `/Users/cgn/git/0xcgn/agents`.

```bash
# After each milestone:
bun run check

# Run data layer tests:
bun test extensions/qmd/__tests__/ui/data.test.ts

# Manual panel test (open pi, then):
# /qmd        → panel opens
# /qp         → panel opens
# Ctrl+Alt+Q  → panel toggles
# u            → update runs
# enter        → file detail
# esc          → close/back
```

## Validation and acceptance

1. `bun run check` — passes with no new errors.
2. Panel opens via `/qmd`, `/qp`, and `Ctrl+Alt+Q`.
3. Panel shows correct binding, freshness, stats, contexts, stale files for this repo.
4. `u` key runs update successfully.
5. `enter` opens file browser, `esc` returns to overview.
6. Non-indexed repo shows "not indexed" view with `i` shortcut.
7. Non-TUI mode prints plain-text summary.
8. `README.md` and `docs/panel.md` document the feature.

## Idempotence and recovery

- Every milestone is additive. No existing behavior is removed.
- If a milestone fails partway, the extension still works — the panel just won't be registered.
- `/qmd status`, `/qmd update`, `/qmd init` subcommands continue to work throughout.
- Rollback: delete `ui/` directory and revert changes to `command.ts`, `index.ts`, `qmd-store.ts`.

## Interfaces and dependencies

### New files

| File | Depends on | Depended on by |
|------|-----------|----------------|
| `ui/constants.ts` | nothing | `ui/panel.ts`, `extension/command.ts` |
| `ui/data.ts` | `core/types.ts`, `core/qmd-store.ts` | `ui/panel.ts`, `ui/plain-text.ts`, tests |
| `ui/panel.ts` | `ui/data.ts`, `ui/constants.ts`, `@mariozechner/pi-tui` | `extension/command.ts` |
| `ui/plain-text.ts` | `ui/data.ts` | `extension/command.ts` |
| `docs/panel.md` | nothing | nothing |
| `__tests__/ui/data.test.ts` | `ui/data.ts`, mocks | nothing |

### Modified files

| File | What changes |
|------|-------------|
| `core/qmd-store.ts` | Add `get_active_document_paths()`, `get_index_health()` |
| `extension/command.ts` | Register panel, alias, shortcut; `/qmd` no-args opens panel |
| `index.ts` | Track panel state, close on session events |
| `README.md` | Document panel |

### External dependencies (already available)

- `@mariozechner/pi-coding-agent` — `ExtensionAPI`, `ExtensionContext`, `Theme`
- `@mariozechner/pi-tui` — `matchesKey`, `truncateToWidth`, `visibleWidth`, `TUI`

## Progress

- [x] M1: Store additions + constants
- [x] M2: Data snapshot layer
- [x] M3: Plain-text fallback
- [x] M4: Panel — overview rendering
- [x] M5: Panel — detail view + keyboard interactions
- [x] M6: Update action + progress
- [x] M7: Command + shortcut registration
- [x] M8: Documentation + quality pass

## Surprises & Discoveries

- `QMDStore` (high-level SDK) does not expose `getActiveDocumentPaths` directly — it's on `store.internal` (the low-level `InternalStore`). Works fine via `store.internal.getActiveDocumentPaths(key)`.
- 5 pre-existing test failures in QMD extension tests due to vitest/bun compatibility (`vi.resetModules()` not supported by bun:test). These are not regressions.
- M4–M6 were implemented together in `panel.ts` since the overview, file browser, and update states are tightly coupled in the same class.

## Decision Log

- **Decision**: Panel lives in `ui/` subdirectory, not `tui/`.
  **Rationale**: `ui/` is more general — it houses both the TUI panel and the plain-text fallback. Matches the principle that the data layer has no TUI dependency.

- **Decision**: `/qmd` with no args opens the panel instead of printing text status.
  **Rationale**: The panel is the primary inspection interface. Text status is still available via plain-text fallback when `hasUI` is false. Subcommands (`/qmd status`, `/qmd update`, `/qmd init`) remain unchanged.

- **Decision**: Snapshot type is flat and serializable, not nested SDK objects.
  **Rationale**: Rule of Representation — fold knowledge into data. The panel doesn't need to understand `RepoBindingResult` discriminated unions or `FreshnessResult` variants. It reads simple fields.

- **Decision**: Panel actions are callbacks, not direct extension imports.
  **Rationale**: Rule of Separation — the panel is a mechanism (rendering), the extension is policy (what update/init mean). Callbacks let the panel stay free of Pi imports.

## Outcomes & Retrospective

(to be filled after work completes)
