# Issue tracker: GitLab

Issues for this repo live as GitLab issues. Use the `glab` CLI for operations.

## Conventions

- **Create an issue**: `glab issue create --title "..." --description "..."`
- **Read an issue**: `glab issue view <number> --comments`
- **List issues**: `glab issue list --state opened -F json`
- **Comment on an issue**: `glab issue note <number> --message "..."`
- **Apply / remove labels**: `glab issue update <number> --label "..."` / `--unlabel "..."`
- **Close**: post a note if needed, then `glab issue close <number>`
- **Merge requests**: use `glab mr ...` commands for PR-equivalent workflows

Infer the repo from `git remote -v` when inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitLab issue.

## When a skill says "fetch the relevant ticket"

Run `glab issue view <number> --comments`.
