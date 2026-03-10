# Review Skill

A reusable, repository-agnostic code review methodology for agents.

## Purpose

Use this skill when the task is to review code changes rather than to implement them. It is designed for local diffs, staged work, branch comparisons, specific files, or change sets passed in by another workflow.

The skill focuses on judgment-based review concerns that automated checks do not fully cover: correctness, security, architecture, maintainability, testing gaps, and dependency risk.

## Workflow

The skill does four things:

1. determine the scope being reviewed
2. gather enough local context to understand the change
3. load the relevant review lenses
4. produce a structured report

If the scope is ambiguous, especially when both staged and unstaged changes exist, the reviewer should ask before proceeding.

## Lenses

The skill ships with six lenses:

- architecture
- correctness
- security
- quality
- testing
- dependencies

These lenses are separate reference files so the agent can load only the ones that matter for the current change.

## Output

The canonical output shape lives in `references/report-format.md`.
It defines a core review report with a summary, findings grouped by lens, and an optional verdict.
Other workflows can wrap that report with extra sections when needed.

## Boundaries

This skill is intentionally portable.
It does not assume a specific repository layout, package manager, linter, test runner, or validation command.
It also does not spend effort on purely mechanical issues such as formatting unless they reveal a deeper design, correctness, or safety problem.

## Relation to PR review

This skill is the reusable review primitive.
A PR-review-specific workflow can reuse it and add GitHub-specific steps such as fetching metadata, comparing claims to the diff, and producing a merge verdict.
