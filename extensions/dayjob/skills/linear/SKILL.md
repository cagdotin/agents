---
name: linear
description: "Interact with Linear using the `linear` CLI for managing issues, projects, and teams."
---

# Linear Skill

Use the `linear` CLI to interact with Linear. Issue IDs use the format `TEAM-123` (e.g. `TEST-42`). Run `linear <command> --help` for full flag details.

## Common Commands

```bash
# issues — --team and --sort are required for list
linear issue list --team TEAM --sort priority --no-pager
linear issue view TEAM-123 --json --no-pager
linear issue view TEAM-123 --json --no-pager | jq '{identifier, title, state, url}'
linear issue create --title "..." --description "..." --team TEAM --no-interactive
linear issue update TEAM-123 --state "In Progress"
linear issue delete TEAM-123 --confirm
linear issue comment add TEAM-123 --body "..."

# teams, projects, labels
linear team list
linear project list
linear label list --json | jq '.[].name'
```

## Tips

- `--team` is required when not inside a repo whose directory name matches a team key.
- `--sort` (`priority` or `manual`) is required for `issue list` — there is no default.
- Always use `--no-pager` on list/view commands to avoid hanging on a pager.
- Always use `--no-interactive` on `create` to skip prompts.
- Always use `--confirm` on `delete` to skip interactive confirmation.
- Use `--json` (supported on `issue view` and `label list`) and pipe to `jq` to keep context small.
- Priority values: `1` (urgent), `2` (high), `3` (medium), `4` (low).
- When working on an issue, checkout a branch matching the issue ID in lowercase (e.g. `team-259` for `TEAM-259`). The CLI auto-detects the linked issue from the branch name for commands like `issue view`, `issue update`, and `comment add`.
