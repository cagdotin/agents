---
name: review
description: Review code changes, diffs, or files for correctness, architecture, security, quality, testing, and dependency risks.
---

# Review

Use this skill when asked to review code changes, a diff, staged work, a branch comparison, or specific files.

## Workflow

1. **Determine the review scope.** Use explicit user input first, then any diff handed in by another workflow, then staged changes, then unstaged changes, then a branch diff. If both staged and unstaged changes exist and the request is ambiguous, ask which scope to review.
2. **Gather context before judging.** Read the changed files, nearby code, tests, and any repository docs or conventions needed to understand how this area is supposed to work.
3. **Load the relevant lenses.** Default to broad review coverage, but only load lenses that meaningfully apply to the changes unless the user asks for a narrower or broader review.
4. **Focus on judgment, not mechanics.** Do not spend the review on formatting, lint, or other purely automatable issues unless they point to a deeper correctness, design, or safety problem.
5. **Produce the report using `references/report-format.md`.** Group findings by lens and omit empty sections.
6. **Suggest alternative approaches only when needed.** Keep this off by default. Offer alternatives only if the user asks or the review reveals a concrete structural problem.

## Available lenses

| Lens | Use when reviewing for | Reference |
|---|---|---|
| Architecture | boundaries, coupling, abstraction fit, pattern drift | `references/lenses/architecture.md` |
| Correctness | logic errors, edge cases, state handling, failure modes | `references/lenses/correctness.md` |
| Security | trust boundaries, auth, secrets, unsafe input handling | `references/lenses/security.md` |
| Quality | clarity, maintainability, docs, observability, accessibility | `references/lenses/quality.md` |
| Testing | missing coverage, weak assertions, regression gaps | `references/lenses/testing.md` |
| Dependencies | new packages, version bumps, supply-chain and maintenance risk | `references/lenses/dependencies.md` |

## Review notes

- State the scope you reviewed before presenting findings.
- Prefer concrete findings over generic advice.
- Distinguish clearly between blocking issues, warnings, and notes.
- When a concern depends on missing context, say what would need to be checked.
- If no issues are found in a loaded lens, omit that lens from the final report.
