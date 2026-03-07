# Session Stats Extension

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
| Read | Files grouped by category (◇ Docs, ◆ Skills, △ Tests, ○ Code) |
| Edit | Unique file list, sorted alphabetically |
| Write | Unique file list, sorted alphabetically |
| expertise | Actions with their domains |
| todo | Actions with counts |

### File Categories (Read files)

Files read are automatically categorized:
- **◇ Docs**: `docs/` prefix, `.md` extension, `README*`, `AGENTS.md`
- **◆ Skills**: `skills/` prefix, `SKILL.md`
- **△ Tests**: `__tests__/`, `.test.ts`, `.spec.ts`
- **○ Code**: everything else

## Non-UI Mode

When UI is unavailable (print/RPC mode), the `/ss` command prints a plain-text summary to stdout, including tool details (bash programs, file lists).
