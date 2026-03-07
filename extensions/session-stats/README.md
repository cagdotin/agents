# Session Stats Extension

In-session observability panel for Pi agent activity.

This extension tracks tool calls, turns, model switches, and other session activity via lightweight event hooks, then presents an on-demand panel with a full breakdown including per-tool bar charts.

## Behavior

Session Stats hooks into Pi's event system to maintain in-memory counters for the current session. Counters reset when a session starts or switches. No data is persisted.

Tracked metrics:

- **Tool calls**: per-tool call counts and error counts (bash, read, edit, write, grep, find, ls, custom tools)
- **Turns**: LLM round-trips within agent loops
- **Agent loops**: how many times the user triggered the agent
- **User prompts**: how many times the user sent input
- **User bash commands**: `!` and `!!` commands
- **Model usage**: which models were active and when they switched
- **Compactions**: how many times context was compacted
- **Session duration**: time since session start

## Usage

Open the stats panel with:

- **Command**: `/session-stats` (alias: `/ss`)
- **Shortcut**: `Ctrl+Alt+T`

The panel shows a bar chart of tool usage, session summary, and model history. Press `r` to refresh, `esc` or `q` to close.

## Footer

A `◉` icon in the footer status bar indicates the extension is loaded. The icon is always accent-colored (informational only, no state-based coloring).

## Panel Layout

```
╭──────────────────────────────────────────────────────────╮
│ ◉ Session Stats                             duration 5m │
│ ──────────────────────────────────────────────────────── │
│ 8 turns    3 loops    0 compactions                     │
│ 3 prompts    1 user !cmds                               │
│ ──────────────────────────────────────────────────────── │
│ Tool Calls  42 total                                    │
│                                                          │
│   bash  ████████████████████  18                        │
│   read  ██████████           10                         │
│   edit  ██████                6   1 err                 │
│   write ████                  4                         │
│ ──────────────────────────────────────────────────────── │
│ Models                                                   │
│   ▸ Claude 4 Sonnet (anthropic) — current               │
│ ──────────────────────────────────────────────────────── │
│   esc close  ·  r refresh                               │
╰──────────────────────────────────────────────────────────╯
```

## Non-UI Mode

When UI is unavailable (print/RPC mode), the `/ss` command prints a plain-text summary to stdout.
