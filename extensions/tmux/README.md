# tmux Extension

Unified tmux integration for Pi, providing notification badges and pane titles.

## Features

### Notification Badge + Sound

When an agent turn ends (duration > 3 seconds):

- **Always** plays a macOS notification sound (`Glass`)
- **If you're on another tmux window**: prefixes window name with `●` and sends BEL
- Badge clears automatically when you switch back or send new input

### Pane Title

Sets a per-pane tmux user option (`@pi_title`) so multiple Pi sessions are easy to distinguish:

- `π project-name · sonnet-4 · fix login bug` — idle, with session title
- `π* project-name · sonnet-4 · fix login bug` — agent currently working
- `π project-name · sonnet-4` — no session title yet

Session title uses explicit name (`/name`) or first user prompt line. Model ID is shortened for readability (e.g., `claude-sonnet-4-20250514` → `sonnet-4`).

#### Why `@pi_title` (not `pane_title`)

Terminal applications can overwrite `pane_title` during redraw/resize events. The `@pi_title` user option is internal to tmux and immune to this.

## Requirements

- Running inside tmux (`$TMUX` set)
- macOS for sound playback (`afplay`) — gracefully skipped on other platforms

## tmux.conf Setup

### Notification bell highlighting (optional)

```tmux
set-option -g bell-action other
set-option -g monitor-bell on
```

### Pane border format (required for pane titles)

```tmux
set -g pane-border-format "#{?pane_active, \
  #[fg=#cba6f7]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} , \
  #[fg=#45475a]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} }"
```

Reload with:

```bash
tmux source-file ~/.tmux.conf
```

## Architecture

- `index.ts` — entry point: tmux guard, pane ID capture, composes sub-modules
- `shared.ts` — shared tmux helpers (`is_tmux`, `tmux`, `escape_tmux`)
- `notify.ts` — notification badge and sound logic
- `pane-title.ts` — pane title management via `@pi_title`

## Lifecycle Hooks Used

- `agent_start` / `agent_end` — both modules (working indicator + notification trigger)
- `input` — notify (clear badge)
- `session_start` / `session_switch` / `session_fork` — pane-title
- `model_select` — pane-title
- `session_shutdown` — both modules (cleanup)
