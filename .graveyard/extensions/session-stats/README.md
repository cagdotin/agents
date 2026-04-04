# Session Stats Extension (Deprecated)

> **Deprecated 2026-04-04.** Superseded by [Ariadne](https://github.com/0xcgn/ariadne), a dedicated Tauri desktop app that covers all the same ground plus cross-session analytics, cost/token tracking, conversation replay, and rich visualizations. Session observability is a user-facing concern and belongs in a standalone app, not embedded in the agent runtime.

In-session observability panel for Pi agent activity.

This extension tracks tool calls, turns, model switches, and other session activity via lightweight event hooks, then presents an on-demand panel with per-tool bar charts and drill-down detail views.

## Behavior

Session Stats hooks into Pi's event system to maintain in-memory counters for the current session. Counters reset when a session starts or switches. No data is persisted.

Tracked metrics:

- **Tool calls**: per-tool call counts and error counts (bash, read, edit, write, grep, find, ls, custom tools)
- **Tool details**: CLI programs invoked via bash, files read/edited/written (with categorization), expertise domains, todo actions
- **Tool coverage**: how many of the available tools were used (`X/Y tools`)
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

### Key Bindings

**List view:**

| Key | Action |
|---|---|
| `j/k`, `↑/↓` | Move tool selection |
| `enter`, `l`, `→` | Open detail for selected tool |
| `g` / `G` | Jump to first / last tool |
| `r` | Refresh stats |
| `esc`, `q` | Close panel |

**Detail view:**

| Key | Action |
|---|---|
| `j/k`, `↑/↓` | Scroll detail content |
| `esc`, `q`, `h`, `←` | Back to list view |
| `g` / `G` | Jump to top / bottom |
| `r` | Refresh stats |
| `t` | Toggle file detail mode (Categories ↔ Timeline) |
| `1` | Switch to Categories mode |
| `2` | Switch to Timeline mode |

## Footer

A `◉` icon in the footer status bar indicates the extension is loaded. The icon is always accent-colored (informational only, no state-based coloring).

## Panel Layout

### List View

Shows session summary, tool call bar chart with selectable rows, and model history.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ◉ Session Stats                                              duration 5m   │
│                                                                              │
│  8 turns   ·   3 loops   ·   0 compactions   ·   4/6 tools                  │
│  3 prompts   ·   1 user !cmds                                               │
│                                                                              │
│ ── Tool Calls ──────────────────────────── 42 total, 1 error ──             │
│                                                                              │
│  ▸ bash   ████████████████████    18                                         │
│    Read   ████████████            10                                         │
│    Edit   ██████                   6   1 err                                 │
│    Write  ████                     4                                         │
│                                                                              │
│ ── Models ──────────────────────────────────────────────────────             │
│                                                                              │
│    ▸ Claude 4 Sonnet (anthropic)  current                                    │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  esc close  ·  r refresh  ·  j/k select  ·  enter detail                     │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### Detail View

Press `enter` on a tool to see its details. Full-width display — no truncation.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ◉ Session Stats › Read                                          10 calls   │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  Files Read (10)                                                             │
│                                                                              │
│  ◇ Docs (3)                                                                  │
│    │ docs/exec-plans/active/2026-03-07-session-stats-phase2.md               │
│    │ docs/specs/2026-03-07-session-stats-phase2.md                           │
│    │ extensions/session-stats/README.md                                      │
│                                                                              │
│  ○ Code (5)                                                                  │
│    │ extensions/session-stats/constants.ts                                   │
│    │ extensions/session-stats/index.ts                                       │
│    │ extensions/session-stats/panel.ts                                       │
│    │ extensions/session-stats/tracker.ts                                     │
│    │ extensions/session-stats/types.ts                                       │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  esc back  ·  r refresh  ·  j/k scroll                                       │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### Detail Content by Tool

| Tool | Detail content |
|---|---|
| Bash | CLI program frequency bar chart |
| Read | Files grouped by category **or** chronological timeline (toggle with `t`) |
| Edit | Files grouped by category **or** chronological timeline (toggle with `t`) |
| Write | Files grouped by category **or** chronological timeline (toggle with `t`) |
| expertise | Actions with their domains |
| todo | Actions with counts |

### File Categories (Read files)

Files read are automatically categorized:
- **◇ Docs**: `docs/` prefix, `.md` extension, `README*`, `AGENTS.md`
- **◆ Skills**: `skills/` prefix, `SKILL.md`
- **△ Tests**: `__tests__/`, `.test.ts`, `.spec.ts`
- **○ Code**: everything else

### File Timeline Mode (Read / Edit / Write)

Press `t` (or `2`) in the Read, Edit, or Write detail view to switch to Timeline mode. This shows every file operation in chronological order with:

- **Timestamps**: local `HH:mm:ss` for each event
- **Order index**: sequential read number across the session
- **Category icons**: same `◇◆△○` markers as Categories mode
- **User message markers**: `● user message` lines show where user prompts occurred
- **Repeat indicator**: `↺` marks files that were read more than once

This lets you answer questions like "After the user's second message, which files did the agent read/edit/write first?" without leaving the panel. Read, Edit, and Write all share the same timeline infrastructure — the mode toggle (`t`, `1`, `2`) works identically for all three tools.

```
16:09:01  ● user message

16:09:03  01 ◇ docs/ARCHITECTURE.md
16:09:05  02 ◆ skills/plan/SKILL.md
16:09:07  03 ○ extensions/session-stats/tracker.ts

16:10:10  ● user message

16:10:11  04 ◇ docs/QUALITY.md
16:10:12  05 ◇ docs/QUALITY.md  ↺
```

## Non-UI Mode

When UI is unavailable (print/RPC mode), the `/ss` command prints a plain-text summary to stdout, including tool details (bash programs, file lists).
