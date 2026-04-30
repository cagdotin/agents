# GitHub Skill

Unified git and GitHub workflow guidance for agents.

## Purpose

This skill combines three related workflows that used to live in separate skills:

- conventional commits
- pull-request review
- general GitHub CLI usage

The top-level `SKILL.md` is a short router. It points the agent to a focused reference file for the current task so the shared skill description stays compact while the detailed guidance remains available on demand.

## References

The skill is organized into three reference files:

- `references/commit.md` — commit message format and commit workflow
- `references/pr-review.md` — PR-specific ceremony such as fetching metadata, diff review setup, claims-vs-reality, and verdicts
- `references/gh-cli.md` — GitHub CLI patterns for pull requests, CI, issues, and API queries

## Relation to the review skill

PR review now delegates the actual code-analysis methodology to `/skill:review`.
That keeps reusable review logic in one place and leaves this skill responsible for GitHub-specific workflow concerns.

## Boundaries

This skill is about workflow routing and GitHub ceremony.
It does not replace repository-specific contribution rules, CI policies, or project architecture guidance.
When a task crosses boundaries, the agent should load the other relevant skills instead of overloading this one.
