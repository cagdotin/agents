---
name: github
description: "Git and GitHub workflows: conventional commits, PR review, CI status, issues, and gh CLI. Load when committing code, creating or reviewing pull requests, checking CI, or interacting with GitHub."
---

# GitHub

Use this skill for git and GitHub workflows.

## Shared guidance

- When running `gh` outside the target repository, always pass `--repo owner/repo`.
- Prefer URLs as inputs when the user already gave one (PR, issue, run, repository).
- Keep GitHub ceremony here and delegate deep code-analysis work to more focused skills when available.

## Routing

- **Committing code** → read `references/commit.md`
- **Reviewing a pull request** → read `references/pr-review.md`
- **Using the `gh` CLI for issues, PRs, CI, or API calls** → read `references/gh-cli.md`

## Notes

- For PR reviews, use `/skill:review` for the actual code analysis and keep this skill focused on GitHub-specific workflow.
- When creating pull requests, create them as drafts unless the user explicitly asks otherwise.
- If the task mixes categories, load every relevant reference file instead of improvising from memory.
