# Session Stats Phase 2: Tool Details & Two-Column Panel

Status: Active
Owner: agent
Created: 2026-03-07
Spec: [[docs/specs/2026-03-07-session-stats-phase2-tool-details.md]]

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

This plan conforms to `skills/plan/PLAN.md`.

## Purpose / Big picture

After this work, a user opening the session-stats panel (`/ss` or `Ctrl+Alt+T`) sees a two-column layout: the left column shows the existing tool call bar chart with selectable rows, and the right column shows detail for the selected tool — CLI programs invoked via bash, files read/edited/written (categorized), expertise domains accessed, and todo actions. A "Tools: 4/6 used" indicator in the summary row shows coverage at a glance.

This enables the user to answer questions like: "Did we read the docs before coding?", "Which CLI commands were run?", "Which files were touched most?" — all without leaving the session.

## Progress

- [x] Milestone 1: Types + tracker logic + tests
- [x] Milestone 2: Two-column panel refactor
- [x] Milestone 3: Integration wiring + README + validation

## Surprises & Discoveries

- Biome formatter has opinions on ternary line breaks and multi-condition `if` wrapping — needed 4 small formatting fixes after initial panel write.

## Decision Log

- Decision: Two-column master-detail layout instead of collapsible sections.
  Rationale: More intuitive navigation. Left column stays compact as an overview. Right column provides drill-down without cluttering the main view. Vim-style h/l navigation is natural for this pattern.
  Date/Author: 2026-03-07 / user + agent

- Decision: Unique file lists only (no edit frequency counts).
  Rationale: User confirmed unique files are sufficient. Keeps the display clean. Frequency per file adds noise without proportional value.
  Date/Author: 2026-03-07 / user

- Decision: File categorization for Read files only (docs/skills/tests/code).
  Rationale: Read files benefit most from categorization — the primary question is "was the right context loaded?" Edit/Write files are typically fewer and don't need grouping.
  Date/Author: 2026-03-07 / user + agent

- Decision: Defer tool execution timing and widget mode to phase 3.
  Rationale: Timing requires different data sourcing (not available in session entries). Widget mode is a display concern that can layer on top of the completed data model.
  Date/Author: 2026-03-07 / user

## Outcomes & Retrospective

(to be filled on completion)

## Context and Orientation

### What exists (phase 1, committed as `711dd6c`)

The `extensions/session-stats/` extension is fully functional:

- **`tracker.ts`**: `reconstruct_stats()` walks `ctx.sessionManager.getBranch()` entries, counting tool results (from `toolResult` message entries), turns, loops, prompts, user bash commands, model changes, and compactions. All pure functions, no side effects.
- **`panel.ts`**: Single-column TUI overlay panel (62 chars wide) with scrolling, bar chart for tool calls, model history, key hints. Class-based with `handleInput()`, `render()`, `invalidate()`.
- **`index.ts`**: Registers `/session-stats` + `/ss` commands, `Ctrl+Alt+T` shortcut, session lifecycle hooks (close panel on session switch), footer status icon. Builds stats via `build_stats(ctx)` helper.
- **`types.ts`**: `SessionStats`, `ToolTally`, `ModelUsageEntry` types.
- **`constants.ts`**: Status key, icon, command names, shortcut, bar char, bar max width.
- **23 tests** in `__tests__/tracker.test.ts` covering all tracker functions.

### Session entry structure (key for this work)

Session entries come from `ctx.sessionManager.getBranch()`. Each entry has `type` and `timestamp`. For `type === "message"`, the `message` field has a `role` discriminator:

- `role === "assistant"` → `content` is `Array<TextContent | ThinkingContent | ToolCall>`.
  - `ToolCall` has: `{ type: "toolCall", id: string, name: string, arguments: Record<string, any> }`.
  - This is where we extract tool arguments: `arguments.command` for bash, `arguments.path` for Read/Edit/Write, etc.
- `role === "toolResult"` → already used for counting calls/errors.
- `role === "user"` → already counted as prompts.
- `role === "bashExecution"` → already counted as user bash commands.

### Available tools API

`pi.getAllTools()` returns `ToolInfo[]` where `ToolInfo = { name: string, description: string, parameters: ... }`. This is on `ExtensionAPI`, not in session entries, so it must be injected separately in `index.ts`.

### Panel pattern

The panel class follows the damage-control pattern:
- Constructor receives `TUI`, `Theme`, options, `done` callback.
- `handleInput(key_data)` dispatches on `matchesKey()`.
- `render(width): string[]` builds framed content.
- `frame_content()` adds box-drawing borders.
- `truncateToWidth()`, `visibleWidth()` from `@mariozechner/pi-tui` for layout.

### Pi TUI key matching

`matchesKey(key_data, spec)` where spec is like `"j"`, `"k"`, `"h"`, `"l"`, `"left"`, `"right"`, `"up"`, `"down"`, `"ctrl+c"`, etc.

## Plan of Work

### Milestone 1: Types + tracker logic + tests

Extend the data model and extraction logic. This is the foundation — pure functions, fully testable without TUI.

1. **`types.ts`** — Add `ToolDetails` interface with fields: `bash_programs: Map<string, number>`, `read_files: string[]`, `edit_files: string[]`, `write_files: string[]`, `expertise_actions: Map<string, string[]>`, `todo_actions: Map<string, number>`. Add `FileCategory` type. Extend `SessionStats` with `tool_details: ToolDetails`, `available_tool_count: number`, `available_tool_names: string[]`.

2. **`tracker.ts`** — Add three new exported functions:
   - `extract_bash_programs(command: string): string[]` — splits on `&&`, `||`, `;`, `|`; skips env var prefixes (`KEY=val`); takes first token; handles path basenames.
   - `categorize_file(path: string): FileCategory` — matches against docs/skills/tests/code patterns.
   - `group_files_by_category(paths: string[]): Map<FileCategory, string[]>` — groups and sorts.
   
   Add internal helper:
   - `extract_tool_call_detail(details: ToolDetails, tool_name: string, args: Record<string, any>): void` — dispatches by tool name, populates the details maps/arrays.
   
   Extend `reconstruct_stats()`: in the `assistant` message case, iterate `message.content` looking for `type === "toolCall"` blocks; call `extract_tool_call_detail()` for each. Initialize `tool_details` in `create_stats()`.

3. **`__tests__/tracker.test.ts`** — Add new test groups:
   - `extract_bash_programs`: ~8-10 cases (simple, chained, piped, env vars, paths, edge cases).
   - `categorize_file`: ~8-10 cases covering all four categories.
   - `group_files_by_category`: 2-3 cases with mixed paths.
   - `reconstruct_stats` with tool call arguments: 3-4 cases (bash with commands, Read with paths, mixed assistant message with multiple tool calls, assistant with no content).

4. Run `bun test extensions/session-stats` — all existing + new tests pass.

### Milestone 2: Two-column panel refactor

Transform the single-column panel into a master-detail layout. This is the biggest milestone — significant panel.ts rewrite.

1. **`constants.ts`** — Add `SESSION_STATS_PANEL_WIDTH = 85`. Update the overlay width in the panel options.

2. **`panel.ts`** — Major refactor of `SessionStatsPanel`:

   **New state:**
   - `selected_tool_index: number` — which tool row is highlighted (0-based into sorted tallies).
   - `focused_column: "left" | "right"` — which column has focus.
   - `right_scroll_offset: number` — independent scroll for the right column.
   - `right_content_lines: string[]` — rendered right column content for current selection.

   **`handleInput()` changes:**
   - `h`, `left` → focus left column (if right is focused).
   - `l`, `right` → focus right column (if left is focused).
   - `j/k`, `up/down` in left column → change `selected_tool_index`, reset `right_scroll_offset`.
   - `j/k`, `up/down` in right column → scroll `right_scroll_offset`.
   - `g/G` → jump to top/bottom of right column (when right focused).

   **`render()` restructure:**
   - Build full-width header (icon, title, duration, summary rows) — spans both columns.
   - Build left column content: tool bar chart with selection marker `▸`, models section.
   - Build right column content: call new method `render_tool_detail(tool_name)` which returns `string[]` for the selected tool.
   - Merge left and right into two-column rows with `│` divider.
   - Build full-width footer with key hints.
   - Frame everything with box-drawing borders.

   **New method `render_tool_detail(tool_name: string): string[]`:**
   - For `"bash"` / `"Bash"`: build bar chart from `tool_details.bash_programs`, same `█` style.
   - For `"Read"`: call `group_files_by_category(tool_details.read_files)`, render with category headers (dimmed).
   - For `"Edit"`: sorted unique list of `tool_details.edit_files`.
   - For `"Write"`: sorted unique list of `tool_details.write_files`.
   - For `"expertise"`: list actions with their domains.
   - For `"todo"`: list actions with counts.
   - Default: dimmed hint "← select a tool to see details".

   **Two-column merge helper:**
   Given `left_lines: string[]` and `right_lines: string[]`, produce merged lines where each row is `left_content │ right_content`, padded to column widths. If one column is shorter, pad with empty lines.

3. **`build_plain_text_summary()`** — Extend to include tool details: bash programs, file lists for Read/Edit/Write. Append after the existing tool tally section.

4. Manual visual check (not automated): open panel, navigate tools, verify right column updates.

### Milestone 3: Integration wiring + README + validation

1. **`index.ts`** — In `build_stats()`, after calling `reconstruct_stats()`, inject available tools:
   ```ts
   const all_tools = pi.getAllTools();
   stats.available_tool_count = all_tools.length;
   stats.available_tool_names = all_tools.map(t => t.name);
   ```

2. **Panel summary row** — Add "Tools: X/Y used" where X = `stats.tool_tallies.size` and Y = `stats.available_tool_count`. If `available_tool_count` is 0 (shouldn't happen but defensive), omit.

3. **`README.md`** — Update with:
   - New two-column layout description.
   - New key bindings (h/l for column switching).
   - Tool detail sections documented.
   - Tool coverage indicator.

4. Run `bun test extensions/session-stats` — all tests pass.
5. Run `bun run check` — no biome or docs errors.
6. Manual verification in a live Pi session with real activity.

## Concrete Steps

All commands run from repository root: `/Users/cgn/git/0xcgn/agents`

### Milestone 1

```bash
# Edit types.ts — add ToolDetails, FileCategory, extend SessionStats
# Edit tracker.ts — add extract_bash_programs, categorize_file, group_files_by_category,
#   extract_tool_call_detail, extend reconstruct_stats and create_stats
# Edit tracker.test.ts — add new test groups

bun test extensions/session-stats
# Expected: all existing 23 tests pass + ~25 new tests pass
```

### Milestone 2

```bash
# Edit constants.ts — add panel width constant
# Rewrite panel.ts — two-column layout, selection state, column focus,
#   render_tool_detail method, two-column merge helper

# No automated tests — manual verification
```

### Milestone 3

```bash
# Edit index.ts — inject pi.getAllTools() into stats
# Edit panel.ts — add "Tools: X/Y used" to summary row
# Edit README.md — update documentation

bun test extensions/session-stats
bun run check
# Expected: all tests pass, no biome errors

# Manual: open /ss in live session, test h/l/j/k navigation,
# verify bash programs, file lists, tool coverage
```

## Validation and Acceptance

### Automated

1. `bun test extensions/session-stats` — all tests pass (existing 23 + new ~25).
2. `bun run check` — no biome or docs validation errors.

### Manual verification

In a live Pi session after some activity (reading files, running bash commands, editing code):

1. Open `/ss` panel.
2. **Tool coverage**: summary row shows "Tools: X/Y used" with correct fraction.
3. **Left column**: tool bar chart is displayed. Arrow `▸` highlights the first tool. `j/k` moves selection.
4. **Right column — bash selected**: shows CLI program frequency bar chart (e.g., `git: 8, bun: 4, grep: 3`).
5. **Right column — Read selected**: shows files grouped by category (docs/, skills/, tests/, code/).
6. **Right column — Edit selected**: shows unique file list.
7. **Column navigation**: `h/l` switches focus. Focused column has accent-colored border/highlight. `j/k` scrolls independently in right column.
8. **Refresh**: `r` re-reads session history. New activity appears.
9. **Close**: `esc` closes panel.
10. **Plain text**: in non-UI mode, `/ss` prints summary including tool details.

## Idempotence and Recovery

All changes modify existing files in `extensions/session-stats/`. No new files are created (except this plan and the spec). Changes are additive to the existing data model — existing fields are preserved, new fields are added. Safe to re-run any step.

If the panel refactor breaks, the tracker logic (milestone 1) is independently testable and valuable. The panel can be reverted to phase 1 without losing the data extraction work.

## Artifacts and Notes

- 58 tests total (23 existing + 35 new) — all pass
- 386 tests across entire repo — all pass
- `bun run check` — clean (biome + docs + tests)
- Files modified: `types.ts`, `tracker.ts`, `panel.ts`, `constants.ts`, `index.ts`, `README.md`, `__tests__/tracker.test.ts`
- No new files created (extended existing modules as planned)

## Interfaces and Dependencies

### Required imports from Pi (unchanged from phase 1)

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
```

### New API usage

```ts
// In index.ts — get available tools
pi.getAllTools(): ToolInfo[]
// Returns: Array<{ name: string, description: string, parameters: ... }>
```

### Session entry structure used (extended)

```ts
// Existing: entry.type === "message", entry.message.role === "toolResult"
// NEW: entry.message.role === "assistant", entry.message.content is Array<...>
//   content items with type === "toolCall" have:
//     { type: "toolCall", name: string, arguments: Record<string, any> }
//   For bash: arguments.command: string
//   For Read/Edit/Write: arguments.path: string
//   For expertise: arguments.action: string, arguments.domain: string
//   For todo: arguments.action: string
```
