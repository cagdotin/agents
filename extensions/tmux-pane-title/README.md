# tmux-pane-title Extension

Sets a per-pane tmux title (`@pi_title`) so multiple Pi sessions are easy to distinguish.

## Display Format

Examples:

- `π project-name · sonnet-4 · fix login bug`
- `π* project-name · sonnet-4 · fix login bug` (agent currently working)

Where:
- `π` / `π*` indicates idle vs active
- project name is derived from current directory
- model id is shortened for readability
- session title uses explicit name (`/name`) or first user prompt line

## Why `@pi_title` (not `pane_title`)

The extension writes to tmux pane user option `@pi_title`, not `pane_title`, because
terminal applications can overwrite `pane_title` during redraw/resize events.
User options are stable and tmux-native.

## Required tmux config

Add a pane border format that prefers `@pi_title` and falls back to default text:

```tmux
set -g pane-border-format "#{?pane_active, \
  #[fg=#cba6f7]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} , \
  #[fg=#45475a]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} }"
```

Reload with:

```bash
tmux source-file ~/.tmux.conf
```

## Lifecycle Hooks Used

- `session_start` / `session_switch` / `session_fork`
- `model_select`
- `agent_start` / `agent_end`
- `session_shutdown` (clears `@pi_title`)
