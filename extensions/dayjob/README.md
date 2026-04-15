# Dayjob Extension

Path-gated work context extension. Activates when the session starts under a configured work directory and injects work-specific skills.

## What it does

- Detects whether the current working directory is inside the configured work root
- Exposes the Linear skill only in work sessions
- Shows a `dayjob` footer status when active

## What it does not do

- It does **not** activate outside the work root
- It does **not** inject any system prompt instructions (skills only)

## Setup

Copy `config.example.json` to `config.json` and set your work root:

```json
{
  "work_root": "~/path/to/your/work/directory"
}
```

`config.json` is gitignored. Without it, the extension silently disables itself.

## Detection

Reads `work_root` from `config.json` at load time, resolves `~` to `$HOME`, then checks if `ctx.cwd` starts with that path. Uses the `register_conditional_feature` pattern — one-time detection, no re-evaluation.

## Skills

- `linear` — Linear CLI interaction for managing issues, projects, and teams
