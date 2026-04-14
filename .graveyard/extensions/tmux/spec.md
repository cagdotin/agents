# tmux Extension — Rebuild Spec

Retired: 2026-04-04

## Purpose

Unified tmux integration for Pi — desktop notifications with sound on agent completion and dynamic pane titles showing session/agent state. Made multiple concurrent Pi sessions easy to distinguish in tmux.

## Reason for retirement

Replaced by the cmux extension, which provides the same notification behavior plus full cmux topology control, browser panels, and markdown viewers.

---

## User-facing surface

### Notification badge + sound

When an agent turn ends (duration > 3 seconds):
- Always plays macOS notification sound (`Glass` via `afplay`)
- If user is on another tmux window: prefixes window name with `●` and sends BEL
- Badge clears automatically when user switches back or sends new input

### Pane title

Sets a per-pane tmux user option (`@pi_title`) for multi-session distinction:
- `π project-name · sonnet-4 · fix login bug` — idle, with session title
- `π* project-name · sonnet-4 · fix login bug` — agent currently working
- `π project-name · sonnet-4` — no session title yet

Session title uses explicit name (`/name`) or first user prompt line. Model ID shortened for readability (e.g., `claude-sonnet-4-20250514` → `sonnet-4`).

### Why `@pi_title` not `pane_title`

Terminal applications can overwrite `pane_title` during redraw/resize events. The `@pi_title` user option is internal to tmux and immune to this.

## Requirements

- Running inside tmux (`$TMUX` set)
- macOS for sound playback (`afplay`) — gracefully skipped on other platforms

## tmux.conf setup

Notification bell: `set-option -g bell-action other` + `set-option -g monitor-bell on`

Pane border format (required for titles):
```tmux
set -g pane-border-format "#{?pane_active, \
  #[fg=#cba6f7]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} , \
  #[fg=#45475a]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} }"
```

## Key implementation details

### tmux helpers

- `is_tmux()` — checks `$TMUX` env var
- `tmux(cmd)` — runs `tmux <cmd>` via `execSync`, swallows errors, 2s timeout
- `escape_tmux(str)` — escapes single quotes for tmux command strings

### Notification logic

- On `agent_end`: check duration > 3s, play sound, check if current window matches pane window, if not set `●` prefix and send BEL
- On `input`: clear `●` prefix if present
- On `session_shutdown`: clear prefix

### Pane title logic

- Captures pane ID on startup via `tmux display-message -p '#{pane_id}'`
- Title format: `π[*] project-name · model-short · session-title`
- Working indicator (`*`) toggled on `agent_start` / `agent_end`
- Updated on `session_start`, `session_switch`, `session_fork`, `model_select`
- Cleared on `session_shutdown`
- Model name shortened: strips provider prefixes and date suffixes

## Lifecycle hooks

- `agent_start` / `agent_end` — both modules (working indicator + notification trigger)
- `input` — notify (clear badge)
- `session_start` / `session_switch` / `session_fork` — pane-title
- `model_select` — pane-title
- `session_shutdown` — both modules (cleanup)

## Dependencies

- `node:child_process` — `execSync` for tmux commands
- `@mariozechner/pi-coding-agent` — lifecycle hooks, `ctx.model`, session APIs
- No external npm dependencies beyond Pi peer deps

## Architecture

- `index.ts` — entry point: tmux guard, pane ID capture, composes sub-modules
- `shared.ts` — shared tmux helpers (`is_tmux`, `tmux`, `escape_tmux`)
- `notify.ts` — notification badge and sound logic
- `pane-title.ts` — pane title management via `@pi_title`
