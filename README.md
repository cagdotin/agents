# Agents

Shared prompts, skills, and extensions for coding agents.

## Structure

```
agents/
├── commands/       # Prompt templates (pi) / Commands (claude code)
├── skills/         # Skills (pi)
├── extensions/     # Extensions (pi)
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

### Claude Code

Symlink the commands directory:

```bash
ln -s /path/to/agents/commands ~/.claude/commands
```

### OpenCode

Symlink the commands directory:

```bash
ln -s /path/to/agents/commands ~/.config/opencode/commands
```

## Usage

### Prompts / Commands

After setup, prompts are available as commands:

| Agent | Usage |
|-------|-------|
| Pi | `/commit` |
| Claude Code | `/commit` |
| OpenCode | `/commit` |

### Skills (Pi only)

Skills are invoked with `/skill:name` or loaded automatically by the agent when relevant.

## Adding New Prompts

1. Create a new `.md` file in `commands/`
2. For pi: run `/reload`
3. For claude code / opencode: changes are picked up automatically via symlink

## License

MIT
