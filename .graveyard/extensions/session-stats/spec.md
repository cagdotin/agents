# Session Stats Extension — Rebuild Spec

Retired: 2026-04-04

## Purpose

In-session observability panel for Pi agent activity. Tracked tool calls, turns, model switches, and other session activity via lightweight event hooks, then presented an on-demand panel with per-tool bar charts, drill-down detail views, file timeline mode, and model history.

## Reason for retirement

Session observability is a user-facing concern better served by a dedicated app. Ariadne covers all session-stats features plus cross-session analytics, cost/token tracking, and conversation replay.

---

## User-facing surface

- `/session-stats` (alias `/ss`) — open stats panel
- `Ctrl+Alt+T` — toggle panel
- Footer: `◉` icon (accent-colored, informational only)

### Panel key bindings

**List view:** `j/k`/arrows to select tool, `enter`/`l`/`→` for detail, `g`/`G` first/last, `r` refresh, `esc`/`q` close

**Detail view:** `j/k`/arrows to scroll, `esc`/`q`/`h`/`←` back, `g`/`G` top/bottom, `r` refresh, `t` toggle file mode, `1` categories, `2` timeline

## Tracked metrics

- Tool calls: per-tool counts and error counts
- Tool details: bash CLI programs, files read/edited/written (with categorization), expertise domains, todo actions
- Tool coverage: X/Y tools used
- Turns, agent loops, user prompts, user bash commands
- Model usage history with switch timestamps
- Compaction count
- Session duration

## Data model

All in-memory, no persistence. State reconstructed from session entries on each session start/switch.

### SessionStats

```typescript
interface SessionStats {
  session_started_at: string | null;
  tool_tallies: Map<string, { calls: number; errors: number }>;
  total_tool_calls: number;
  total_tool_errors: number;
  turn_count: number;
  agent_loop_count: number;
  user_prompt_count: number;
  user_bash_count: number;
  compaction_count: number;
  model_history: ModelUsageEntry[];
  tool_details: ToolDetails;
  available_tool_count: number;
  available_tool_names: string[];
}
```

### ToolDetails

Tracks per-tool specifics:
- `bash_programs: Map<string, number>` — CLI program frequency
- `read_files/edit_files/write_files: string[]` — unique file paths
- `read_timeline_events/edit_timeline_events/write_timeline_events: FileTimelineEvent[]` — chronological operations
- `expertise_actions: Map<string, string[]>` — action → domains
- `todo_actions: Map<string, number>` — action → count

### File categories

Files automatically categorized: `◇ Docs` (docs/, .md, README, AGENTS.md), `◆ Skills` (skills/, SKILL.md), `△ Tests` (__tests__/, .test.ts), `○ Code` (everything else)

### File timeline events

Two kinds: `file-op` (timestamp, order, path, category, user_message_index, is_repeat) and `user-marker` (timestamp, user_message_index). Enables "what did the agent read after the user's Nth message?" queries.

## State reconstruction

`reconstruct_stats()` walks `ctx.sessionManager.getBranch()` entries:
- `message` entries with role `toolResult` → tool tallies
- `message` entries with role `assistant` → turn count, agent loop detection, tool call argument extraction for details
- `message` entries with role `user` → user prompt count, timeline user markers
- `message` entries with role `bashExecution` → user bash count
- `model_change` entries → model history
- `compaction` entries → compaction count

Agent loops estimated: each user message followed by assistant activity = one loop.

## Key implementation details

### Bash program extraction

Quote-aware command splitting on `&&`, `||`, `;`, `|`. Tokenizes each segment, skips env var prefixes (`KEY=val`), extracts first valid program token. Strips path to basename. Validates with `/^[a-zA-Z0-9_.][a-zA-Z0-9_.-]*$/`.

### Panel rendering

List view: session summary header, tool call bar chart (sorted by count, selectable rows with cursor), model history section.

Detail view: tool-specific content — bash shows CLI program frequency chart, read/edit/write show files by category (or timeline with `t` toggle), expertise shows action→domain, todo shows action→count.

### Non-UI fallback

Prints plain-text summary to stdout when `ctx.hasUI` is false.

## Lifecycle

- `session_start` / `session_switch` — close panel if open, reconstruct stats, set footer status
- Panel: on-demand via command/shortcut, fresh reconstruction on each open/refresh

## Dependencies

- `@mariozechner/pi-coding-agent` — lifecycle hooks, `ctx.sessionManager.getBranch()`, `ctx.ui.custom()`, `ctx.ui.setStatus()`
- `@mariozechner/pi-tui` — `DynamicBorder`, `Text`, TUI component infrastructure
- Pi APIs: commands, shortcuts, session events
