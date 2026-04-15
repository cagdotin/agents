# Dayjob Extension

Path-gated work context extension. Activates when the session starts under a configured work directory and injects work-specific skills with templated values.

## What it does

- Detects whether the current working directory is inside the configured work root
- Renders skill templates with config values (e.g. `{{team}}` → your actual team key)
- Exposes rendered skills only in work sessions
- Shows a `meister` footer status when active

## What it does not do

- It does **not** activate outside the work root
- It does **not** inject any system prompt instructions (skills only)

## Setup

Copy `config.example.json` to `config.json` and fill in your values:

```json
{
  "work_root": "~/git/dev/your-company",
  "linear": {
    "team": "ACME"
  }
}
```

`config.json` is gitignored. Without it, the extension silently disables itself.

## Skill templating

Skill files in `skills/` use `{{var}}` placeholders. At init, the extension reads templates, replaces placeholders with values from `config.json`, writes rendered files to `out/skills/<name>/SKILL.md`, and returns those directory paths to Pi.

Currently available variables:

| Variable | Source | Example |
|----------|--------|---------|
| `{{team}}` | `config.linear.team` | `ACME` |
| `{{team_lower}}` | `config.linear.team` (lowercased) | `acme` |

## File layout

```
extensions/dayjob/
├── index.ts                # Extension entry point — feature wiring
├── config.ts               # Config loader (reads config.json)
├── constants.ts            # Paths, zod schemas, exported types
├── skills.ts               # Skill templating — parse and generate
├── config.json             # Local config (gitignored)
├── config.example.json     # Template for config.json
├── skills/
│   └── linear/
│       └── SKILL.md        # Template with {{var}} placeholders
├── out/                    # Generated output (gitignored)
│   └── skills/
│       └── linear/
│           └── SKILL.md    # Rendered with concrete values
└── README.md
```

## Detection

Reads `work_root` from `config.json` at load time, resolves `~` to `$HOME`, then checks if `ctx.cwd` starts with that path. Uses the `register_conditional_feature` pattern — one-time detection, no re-evaluation.

## Skills

- `linear` — Linear CLI interaction for managing issues, projects, and teams
