# cmux Extension

Detects when Pi is running inside [cmux](https://cmux.dev) and provides integrated notifications, tab titles, and the cmux skill for agent topology control.

## Features

### Skill Injection

Registers the cmux skill into `<available_skills>` so the agent can load it on-demand. Adds a small nudge telling the agent it's running in cmux with CLI access.

### Notification (Sound + Flash)

When the agent finishes processing (duration > 3 seconds):

- **Always** sends a native macOS notification via `cmux notify`
- **If user is on another workspace**: triggers a flash indicator on the surface tab

### Tab Title

Sets the cmux tab title to show project, model, session, and status:

- `π agents · sonnet-4 · fix login bug` — idle, with session title
- `π* agents · sonnet-4 · fix login bug` — agent currently working
- `π agents · sonnet-4` — no session title yet

Title clears automatically on exit so the tab reverts to its default name.

### Sidebar Status

Shows a status pill in the cmux sidebar:

- `✦ working` (amber) — agent is processing
- `✦ idle` — agent is idle

## Requirements

- Running inside cmux (`CMUX_WORKSPACE_ID` / `CMUX_SURFACE_ID` set, or cmux in process tree)
- `cmux` CLI available in `$PATH`

## Skill Content

The cmux skill lives in `skills/cmux/` as raw markdown:

```
skills/cmux/
├── SKILL.md                              # Core: concepts, fast start, handle model
└── references/
    ├── handles-and-identify.md           # Handle syntax, self-identify, caller targeting
    ├── windows-workspaces.md             # Window/workspace lifecycle
    ├── panes-surfaces.md                 # Splits, surfaces, move/reorder
    └── trigger-flash-and-health.md       # Flash cue and surface health
```

Skill source: [manaflow-ai/cmux on skills.sh](https://skills.sh/manaflow-ai/cmux/cmux)

## Architecture

- `index.ts` — entry point: detection guard, skill injection, composes sub-modules
- `detect.ts` — cmux detection (env vars + process tree walk)
- `shared.ts` — shared cmux CLI helpers (`cmux`, `cmux_json`, `escape_shell`)
- `notify.ts` — notification and flash logic
- `tab-title.ts` — tab title and sidebar status management
- `skills/cmux/` — raw skill markdown files

## Lifecycle Hooks Used

- `before_agent_start` — skill injection + system prompt nudge
- `agent_start` / `agent_end` — both sub-modules (working indicator + notification)
- `session_start` / `session_switch` / `session_fork` — tab-title
- `model_select` — tab-title
- `session_shutdown` — both sub-modules (cleanup)
