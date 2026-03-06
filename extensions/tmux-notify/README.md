# tmux-notify Extension

Adds tmux-native attention signals when Pi finishes a longer agent run.

## Behavior

When an agent turn ends and duration is > 3 seconds:

- always plays a macOS notification sound (`Glass`)
- if you are on a different tmux window, prefixes the window name with `●`
- sends BEL (`\x07`) for tmux `monitor-bell` highlighting

Badge clears automatically when:
- you switch back to the window, or
- you send new input

## Requirements

- running inside tmux (`$TMUX` set)
- macOS for sound playback (`afplay`)

## Optional tmux config

To enable bell-based highlighting:

```tmux
set-option -g bell-action other
set-option -g monitor-bell on
```

## Implementation Notes

- Captures a stable `pane_id` at startup and always targets that pane/window.
- Uses periodic focus polling while badge is active to auto-clear on return.
- Cleans up state on `session_shutdown`.
