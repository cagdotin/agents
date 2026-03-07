# Session Stats Extension — In-Session Observability Panel

Status: Approved
Todo: TODO-e636f4a5
Date: 2026-03-07

## 1. Problem Statement

When working in a Pi session, there is no way to see a summary of what happened — how many tool calls were made, which tools were used most, how many turns the agent took, or which models were active. This makes it hard to understand agent behavior patterns, debug inefficiencies, or simply review what the agent did during a session.

Desired end state:
- A dedicated extension provides an on-demand panel showing session activity stats.
- Stats are reconstructed from session history entries on demand, always reflecting the full session.
- The panel is accessible via a slash command and keyboard shortcut.
- A footer icon indicates the extension is loaded.

## 2. Goals and Non-Goals

### 2.1 Goals

- Provide a `session-stats` extension under `extensions/` that presents session activity.
- Reconstruct stats on demand from `ctx.sessionManager.getBranch()` session entries:
  - Per-tool call counts (bash, read, edit, write, grep, find, ls, custom tools)
  - Per-tool error counts
  - Total turn count and agent loop count
  - Model usage (which models were active, model switches)
  - Compaction count
  - User prompt count and user bash command count (`!`/`!!`)
  - Session start time (from first entry timestamp, for duration calculation)
- Provide a panel (via `/session-stats` command, alias `/ss`, shortcut `Ctrl+Alt+T`) showing full breakdown.
- Provide a compact footer status icon indicating the extension is loaded.
- Panel reconstructs stats from session history each time it opens; `r` key re-reads for latest data.
- Stats always reflect the full session, including activity before extension reload.

### 2.2 Non-Goals

- Live-updating widget above/below editor (deferred to future enhancement).
- Token cost estimation (already available in Pi's built-in footer).
- Skill load tracking — detecting which SKILL.md files the agent read (deferred to phase 2).
- Expertise domain injection tracking (deferred; requires EventBus integration with expert extension).
- Tool execution duration/timing tracking (deferred to phase 2).

## 3. System Context

New module:

```text
extensions/session-stats/
├── index.ts          # extension entry: commands, shortcut, footer, session lifecycle
├── constants.ts      # status keys, icons, command names, shortcut
├── types.ts          # SessionStats, ToolTally, ModelUsageEntry types
├── tracker.ts        # session reconstruction + utility functions (pure data, no UI)
├── panel.ts          # TUI panel component (overlay, scrollable)
├── README.md         # behavior and usage docs
└── __tests__/
    └── tracker.test.ts
```

Integration points:
- **Pi session manager**: `ctx.sessionManager.getBranch()` for reading session entries on demand.
- **Pi event hooks**: `session_start`, `session_switch` (for closing panel and setting footer only).
- **Pi UI APIs**: `ctx.ui.setStatus()` for footer, `ctx.ui.custom()` for panel overlay.
- **No cross-extension dependencies.** Does not import from damage-control or expert.

## 4. Domain Model

### SessionStats (reconstructed on demand)

```ts
interface ToolTally {
  calls: number;
  errors: number;
}

interface ModelUsageEntry {
  model_id: string;
  model_name: string;
  provider: string;
  selected_at: string; // ISO timestamp
}

interface SessionStats {
  session_started_at: string | null;  // first entry timestamp
  tool_tallies: Map<string, ToolTally>; // keyed by tool name
  total_tool_calls: number;
  total_tool_errors: number;
  turn_count: number;
  agent_loop_count: number;
  user_prompt_count: number;
  user_bash_count: number;
  compaction_count: number;
  model_history: ModelUsageEntry[];    // ordered list, most recent last
}
```

### Tracker API (pure functions)

```ts
function create_stats(): SessionStats;
function reconstruct_stats(
  branch_entries: Array<{ type: string; timestamp: string; [key: string]: unknown }>,
  current_model?: { id: string; name: string; provider: string },
): SessionStats;
function get_session_duration_label(stats: SessionStats): string;
function get_sorted_tool_tallies(stats: SessionStats): Array<[string, ToolTally]>;
function get_current_model(stats: SessionStats): ModelUsageEntry | null;
function get_unique_models_used(stats: SessionStats): ModelUsageEntry[];
```

## 5. Detailed Design

### 5.1 Session Reconstruction

Stats are computed by walking `ctx.sessionManager.getBranch()` — the current branch of session entries from root to leaf. Each entry is inspected by type:

| Entry type | Field | What we extract |
|---|---|---|
| `message` | `message.role === "toolResult"` | `toolName` + `isError` → per-tool tallies |
| `message` | `message.role === "assistant"` | Turn count; agent loop detection (user→assistant transition) |
| `message` | `message.role === "user"` | User prompt count |
| `message` | `message.role === "bashExecution"` | User `!`/`!!` command count |
| `model_change` | `modelId`, `provider` | Model history |
| `compaction` | — | Compaction count |
| First entry | `timestamp` | Session start time |

Agent loops are estimated by counting user→assistant transitions: each time an assistant message follows a user message, that's one agent loop. Multiple assistant turns within a single loop (tool use chains) don't increment the loop count.

The current model from `ctx.model` is used to seed the model history when no `model_change` entries exist (common for single-model sessions), and to provide a human-friendly name for the current model when `model_change` entries only contain the model ID.

### 5.2 Footer Status

A single icon in the footer status bar, always visible:

- Icon: `◉` (U+25C9, FISHEYE — compact, clean, suggests "observing")
- Color: always `accent` (no state-based coloring needed — it's informational)
- Status key: `"session-stats"`

The icon serves as a "this extension is loaded" indicator. No dynamic text — the panel provides full detail.

### 5.3 Panel Layout

Opened via `/session-stats` (alias `/ss`) or `Ctrl+Alt+T`. Overlay, centered, ~60 columns wide.

```
╭──────────────────────────────────────────────────────────╮
│ ◉ Session Stats                             duration 5m │
│ ──────────────────────────────────────────────────────── │
│ 8 turns    3 loops    0 compactions                     │
│ 3 prompts    1 user !cmds                               │
│ ──────────────────────────────────────────────────────── │
│ Tool Calls  42 total, 1 error                           │
│                                                          │
│   bash     ████████████████████  18                     │
│   read     ██████████           10                      │
│   edit     ██████                6   1 err              │
│   write    ████                  4                      │
│   grep     ██                    2                      │
│   find     ██                    2                      │
│ ──────────────────────────────────────────────────────── │
│ Models                                                   │
│   ▸ Claude 4 Sonnet (anthropic) — current               │
│ ──────────────────────────────────────────────────────── │
│   esc close  ·  r refresh                               │
╰──────────────────────────────────────────────────────────╯
```

Key design choices:
- **Bar chart**: horizontal bars using `█` characters, scaled to the tool with the most calls. Provides instant visual hierarchy.
- **Error counts**: shown inline next to the bar, only when > 0, in error color.
- **Models section**: lists all unique models used in the session, marks the current one.
- **Scrollable**: if content exceeds panel height, `j/k` or `↑/↓` to scroll.
- **Refresh**: `r` key reconstructs stats from session history (always current, survives reload).

### 5.4 Panel Interactions

| Key | Action |
|---|---|
| `esc`, `q` | Close panel |
| `Ctrl+Alt+T` | Toggle panel (close if open) |
| `r` | Refresh (re-read session history) |
| `j/k`, `↑/↓` | Scroll if content overflows |
| `g` / `G` | Jump to top / bottom |
| `Page Up/Down` | Page scroll |

### 5.5 Non-UI Fallback

When `ctx.hasUI` is false (print/RPC mode), the `/ss` command prints a plain-text summary to stdout.

## 6. Error Handling and Failure Modes

- **Panel render failure**: catch and fall back to `ctx.ui.notify()` with plain-text summary (same pattern as damage-control).
- **Missing model data**: if `ctx.model` is undefined, display "(none recorded)" in model section.
- **Zero tool calls**: show "(none yet)" instead of empty bar chart.

## 7. Testing Strategy

### 7.1 Unit Tests

- `tracker.test.ts`: test `reconstruct_stats()` with synthetic session entries, plus utility functions.
- Test cases: empty session, tool result counting with errors, turn/loop counting, user prompt/bash counting, model change tracking, compaction counting, model seeding from `ctx.model`, realistic full-session scenario.

### 7.2 Integration Tests

Not required for v1. The tracker is pure data manipulation; the panel is a TUI component best validated manually.

## 8. Implementation Checklist

- [x] Create `extensions/session-stats/` directory structure
- [x] Define types in `types.ts`
- [x] Define constants in `constants.ts`
- [x] Implement tracker logic in `tracker.ts`
- [x] Write tracker unit tests in `__tests__/tracker.test.ts`
- [x] Implement panel TUI component in `panel.ts`
- [x] Wire everything together in `index.ts` (commands, shortcut, footer, session lifecycle)
- [x] Write `README.md`
- [x] Run `bun run check` — passes (340 tests, 0 errors)

## 9. Open Questions

None — scope is well-defined and self-contained.
