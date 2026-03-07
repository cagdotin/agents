# Agents

Shared skills, extensions, themes, and documentation for coding agents.

## Structure

```
agents/
├── AGENTS.md            # Global operating notes (short map)
├── docs/
│   ├── ARCHITECTURE.md  # Repository architecture + boundaries
│   ├── QUALITY.md       # Quality scorecard + prioritized gaps
│   ├── specs/           # Implementation specs for planned/complex work
│   ├── references/      # Internal quick references (Pi API, etc.)
│   └── resources/       # External resource captures (articles/videos)
├── extensions/          # Pi extensions
│   ├── answer/
│   ├── damage-control/
│   ├── expert/
│   ├── todos/
│   ├── tmux-notify/
│   └── tmux-pane-title/
├── skills/              # Agent skills (SKILL.md based)
└── pi-themes/           # Pi theme JSON files
```

## Setup

### Pi

Add this repo as a package in `~/.pi/agent/settings.json`:

```json
{
  "packages": ["/path/to/agents"]
}
```

Or install via git:

```bash
pi install git:github.com/cagdotin/agents
```

Then run `/reload` in Pi.

## Development

This repository standardizes on **Bun**.

```bash
bun install
bun run hooks:install
bun run check
bun run fix
bun run format
```

- `bun install` also runs the `prepare` script to install Lefthook automatically.
- Run `bun run hooks:install` manually if hooks were not installed (or after cloning with scripts disabled).
- `pre-commit` runs `bun run check` via Lefthook.

Use `bunx` for ad-hoc binaries. Do not use npm/yarn/pnpm in this repo.

## Usage

### Skills (Pi)

Skills can be invoked with `/skill:name` or loaded automatically by the agent when relevant.

### Extensions (Pi)

Extensions are auto-discovered through this package manifest and loaded by Pi.

## License

MIT
