# Agents

Shared skills, extensions, themes, and documentation for coding agents.

## Structure

```
agents/
├── AGENTS.md              # Global operating notes (short map)
├── docs/
│   ├── ARCHITECTURE.md    # Repository architecture + boundaries
│   ├── DESIGN-PRINCIPLES.md # Design principles from research
│   ├── QUALITY.md         # Quality scorecard + prioritized gaps
│   ├── CONTRIBUTING-DOCS.md # Rules for documentation work
│   ├── TESTING.md         # Testing model and boundaries
│   ├── specs/             # Implementation specs for planned/complex work
│   ├── exec-plans/        # Active/completed execution plans
│   └── references/        # Internal quick references (Pi API, etc.)
├── extensions/            # Pi extensions
├── lib/                   # Shared extension runtime helpers
├── skills/                # Package-wide agent skills grouped by category
└── pi-themes/             # Pi theme JSON files
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

This repo has two skill models:
- top-level `skills/` — package-wide always-available skills; Pi discovers `SKILL.md` directories recursively, so categories like `engineering/`, `productivity/`, and `tools/` can group related skills
- extension-owned skills under `extensions/<name>/skills/` — exposed conditionally through extension runtime detection

### Extensions (Pi)

Extensions are auto-discovered through this package manifest and loaded by Pi.

## License

MIT
