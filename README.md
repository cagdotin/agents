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

## Install in Claude Code

Claude Code docs expect personal skills at `~/.claude/skills/<skill-name>/SKILL.md`.
Because this repo groups skills under category directories, use the linker script to expose only the leaf skills under `skills/`:

```bash
pnpm run sync:claude-skills
```

What it does:
- links each repo skill directory to your Claude Code personal skills directory
- excludes extension-injected skills because it only scans top-level repo `skills/`
- links shared support directories needed by some engineering skills
- respects `CLAUDE_CONFIG_DIR` when set; otherwise uses `~/.claude`

If `~/.claude/skills/` did not exist when Claude Code started, restart Claude Code once so it begins watching that directory. After that, edits inside linked skills are picked up live.

## Development

This repository standardizes on **pnpm + Vite+**.

```bash
pnpm install
pnpm run hooks:install
pnpm run check
vp run check
vp test
pnpm run fix
pnpm run format
```

- Run `pnpm run hooks:install` after cloning to install Lefthook hooks for this repo.
- `pnpm run check` is the canonical full repo gate: Biome, docs validation, boundary validation, and tests.
- `vp run check` runs that same repo-defined gate through the Vite+ task runner.
- `vp test` is the built-in Vite+ Vitest loop for the test configuration in `vite.config.ts`.
- `vp run build` and `vp run pack` are intentional no-ops because Pi loads this package's TypeScript and markdown resources directly.
- `pre-commit` runs the configured Lefthook checks.

## Where to look next

- `AGENTS.md` — agent operating map for this repo
- `docs/ARCHITECTURE.md` — bird's-eye repository overview
- `docs/README.md` — documentation category map

## License

MIT
