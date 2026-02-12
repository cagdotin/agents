# Agents

Shared skills and extensions for coding agents.

## Structure

```
agents/
├── skills/         # Skills (all agents)
├── extensions/     # Extensions (pi)
│   ├── answer/        # Q&A extraction from assistant messages
│   ├── todos/         # File-based todo management
│   ├── tmux-notify/   # Tmux window badge when agent finishes
│   └── notify.ts      # Desktop notifications (OSC 777)
└── themes/         # Themes (pi)
```

## Setup

### Pi

Add this repo as a local package in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/path/to/agents"
  ]
}
```

Or install via git:

```bash
pi install git:github.com/cagdotin/agents
```

Then run `/reload` in pi to pick up changes.

## Usage

### Skills (Pi only)

Skills are invoked with `/skill:name` or loaded automatically by the agent when relevant.

## License

MIT
