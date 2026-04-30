# Agents

Shared skills, extensions, themes, and support docs for coding agents.

## What this package contains

- **Extensions** under `extensions/` for Pi runtime behavior
- **Skills** under `skills/` for reusable operating methodology
- **Themes** under `pi-themes/` for Pi UI customization
- **Support docs** under `docs/` for architecture, decisions, conventions, testing, and shared references

## Install in Pi

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
- Run `bun run hooks:install` manually if hooks were not installed, or after cloning with scripts disabled.
- `pre-commit` runs `bun run check` via Lefthook.

## Where to look next

- `AGENTS.md` — agent operating map for this repo
- `docs/ARCHITECTURE.md` — bird's-eye repository overview
- `docs/README.md` — documentation category map

## License

MIT
