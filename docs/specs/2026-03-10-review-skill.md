# Review Skill — Universal Code Review Methodology

Status: Draft
Date: 2026-03-10
Execution plan: [[docs/exec-plans/active/2026-03-10-review-skill.md]]

## 1. Problem statement

Code review logic is currently embedded inside `skills/pr-review/SKILL.md`, tightly coupled to GitHub PRs. This means:

- Reviewing local changes (staged, branch diff, specific files) requires improvisation — there's no structured methodology the agent can follow.
- The review checklist can't be reused outside the PR context.
- There's no way to run a focused review on a single dimension (e.g., security only, architecture only).
- Future sub-agent review workflows have nothing to delegate to — the methodology doesn't exist as a standalone artifact.

The project needs a **standalone review skill** that defines a reusable, lens-based code review methodology. It should work on any diff source and be consumable by both the agent directly and (in the future) by a spawned review sub-agent.

## 2. Goals and non-goals

### 2.1 Goals

- Create `skills/review/SKILL.md` as a router that determines review scope and selects relevant lenses.
- Extract the review checklist from `pr-review` into independent **lens files** under `skills/review/references/lenses/`.
- Each lens is a self-contained reference the agent loads only when needed (progressive disclosure).
- The SKILL.md includes a lens index table so the agent can scan all available lenses and pick the ones relevant to the changes.
- Define a structured **core report format** (`references/report-format.md`) so review findings are consistent regardless of trigger.
- The skill works on any diff source: `git diff`, `git diff --staged`, `git diff main..feature`, specific files, or a diff handed from another skill (e.g., PR review).
- "Alternative approaches" analysis is **off by default** — only activated when the user explicitly asks or when the review surfaces a concrete structural problem.

### 2.2 Non-goals

- **Self-review / Ralph Wiggum Loop** — deferred. The review skill can be invoked manually or by a future review sub-agent, but it does not auto-trigger pre-commit.
- **Sub-agent orchestration** — the skill defines methodology only. Spawning a review sub-agent is a future concern (depends on `TODO-48c425ca` subagent-widget).
- **GitHub integration** — fetching PRs, posting comments, rendering verdicts. That stays in the `github` skill's `pr-review.md` reference.
- **Linting / mechanical checks** — the review skill does not own repository-specific validation commands, linters, formatters, type-checkers, test runners, or package-manager-based checks. It focuses on judgment-based analysis; callers may run automation separately.
- **Modifying `pr-review` or `github` skills** — that's tracked in a separate plan. This spec only creates the review skill.

## 3. System context

### Affected modules

- `skills/review/` — new skill directory (does not exist yet)
- `skills/pr-review/` — will eventually be retired, but **not in this plan**

### Conventions

- Skills are static markdown — no runtime code, no imports.
- SKILL.md requires frontmatter with `name` and `description` per the Agent Skills spec.
- `name` must match the parent directory (`review`).
- `description` determines when the agent auto-loads the skill — must be specific enough to trigger on review-related prompts.
- Reference files live under `references/` and are loaded on-demand via relative paths.
- File/folder names: kebab-case.

### Integration points

- The `github` skill's `pr-review.md` reference (created in the separate github skill plan) will recommend loading `/skill:review` for thorough analysis and will reference the same core report format.
- The review skill should remain repository-agnostic. It may instruct the agent to gather relevant repository context, but it should not hardcode project-specific filenames or conventions.
- Until follow-up migrations land, `skills/pr-review/` remains the canonical PR review entrypoint. The new `review` skill becomes the reusable methodology that later consumers can call into.

## 4. Domain model

### Concepts

- **Review scope**: The set of changes being reviewed. Could be a git diff, staged changes, a branch comparison, specific files, or a diff blob handed from another workflow.
- **Lens**: A focused review dimension (e.g., architecture, security, correctness). Each lens has its own reference file with specific things to look for, questions to ask, and patterns to flag.
- **Finding**: A concrete observation from applying a lens. Has a severity (blocking, warning, note), a location (file + line/region), and a description.
- **Report**: The structured output of a review — summary, findings grouped by lens, and an optional verdict.

### Lens catalog (initial set)

| Lens | File | Focus |
|---|---|---|
| Architecture | `lenses/architecture.md` | Boundary violations, layer model, pattern drift, coupling, separation of concerns |
| Correctness | `lenses/correctness.md` | Logic errors, edge cases, error handling, null/undefined, race conditions, type safety |
| Security | `lenses/security.md` | Injection, auth/authz, secrets, input validation, unsafe deserialization |
| Quality | `lenses/quality.md` | Duplication, naming, complexity, dead code, readability, maintainability, docs, observability, accessibility for UI changes |
| Testing | `lenses/testing.md` | Missing tests, coverage gaps, test quality, edge cases not covered |
| Dependencies | `lenses/dependencies.md` | New deps justified, version bumps, license, unused deps |

Lenses are additive — new ones can be added (e.g., `performance.md`, `accessibility.md`, `observability.md`) without changing the skill router.

## 5. Detailed design

### 5.1 SKILL.md (the router)

The SKILL.md is kept short (~40-60 lines). Its job:

1. **Determine scope** — instruct the agent to identify what's being reviewed and how to obtain the diff.
2. **Gather context** — instruct the agent to read surrounding code, repository docs, and any other relevant context sources needed to understand the system before judging the changes.
3. **Lens index table** — a table listing all available lenses with one-line descriptions. The agent scans this and decides which lenses to load based on the changes.
4. **Default behavior** — apply the lenses relevant to the changes unless the user or caller requests a narrower set.
5. **Review boundary** — focus on non-mechanical review concerns. Do not spend the review on formatting, lint, or other purely automatable issues unless they reveal a deeper design, correctness, or safety problem.
6. **Report** — point to `references/report-format.md` for output structure.
7. **Alternative approaches clause** — off by default. Only suggest alternatives when: (a) the user explicitly asks, or (b) findings reveal a concrete structural problem where the current approach conflicts with the repository's established architecture or patterns.

### 5.2 Lens reference files

Each lens file follows a consistent internal structure:

```markdown
# <Lens Name>

## What to look for
- Bullet list of specific things to examine

## Questions to ask
- Guiding questions the reviewer should answer about the changes

## Common patterns to flag
- Anti-patterns, known pitfalls, red flags specific to this dimension

## Context to gather
- The kinds of surrounding files, docs, or conventions the agent should inspect
  before forming conclusions in this lens
```

Lens files should be **concise** (30-60 lines each). They're guidance for an intelligent agent, not exhaustive checklists — the agent applies judgment.

### 5.3 Report format

`references/report-format.md` defines the reusable **core review report**:

```markdown
# Review Report

## Summary
One paragraph: what was reviewed, scope size, overall assessment.

## Findings

### [Lens Name]

#### [severity: blocking|warning|note] Finding title
- **Location**: file:line (or region)
- **Description**: what was found
- **Why it matters**: impact if not addressed
- **Suggestion**: how to fix (when applicable)

## Verdict (optional)
Only when the caller requests a verdict (e.g., PR review flow).
One of: Approve / Request Changes / Comment.
```

Findings are grouped by lens. Empty lenses (no findings) are omitted from the report. The verdict section is optional — it's relevant for PR reviews but not for general "review my changes" flows.

Callers may wrap this core report with additional workflow-specific sections. For example, a PR review flow may prepend sections like "Claims vs Reality" or "Change Analysis" before the core review findings.

### 5.4 Scope determination

The SKILL.md router should instruct the agent to determine the diff source in this priority order:

1. **Explicit user input** — "review these files", "review the diff between X and Y"
2. **Handed diff** — a diff blob or explicit change set passed from another workflow (e.g., PR review)
3. **Staged changes** — `git diff --staged` (if the user says "review my changes" and only staged files are clearly intended)
4. **Unstaged changes** — `git diff` (working tree changes)
5. **Branch diff** — `git diff main..HEAD` or equivalent (if on a feature branch)

If both staged and unstaged changes exist and the user request is ambiguous, the agent should ask which scope to review before proceeding.

The agent should state what scope it determined and confirm with the user if ambiguous.

## 6. Error handling and failure modes

Not applicable — this is a static skill (markdown instructions), not runtime code. The agent handles errors naturally (e.g., "no changes to review", "git not available").

## 7. Security and safety considerations

The review skill instructs the agent to read files and produce a report. It does not execute arbitrary code, modify files, or make network requests. No security concerns beyond standard agent behavior.

The security *lens* teaches the agent to look for security issues in reviewed code — that's a feature, not a risk.

## 8. Testing strategy

### 8.1 Validation

Since this is a static skill (no runtime code), validation of the skill design means:

- Manual smoke test: invoke `/skill:review` and verify the agent follows the methodology correctly.
- Verify all relative paths in SKILL.md resolve to actual files.
- Confirm the skill instructions remain repository-agnostic and do not assume specific package managers, linters, or validation commands.

Repository-local validation commands may still be used while implementing this skill in a specific repository, but those commands are not part of the skill design and should not appear in the skill instructions.

### 8.2 No unit tests

Skills are markdown. There's nothing to unit test.

## 9. Implementation checklist

- [ ] Create `skills/review/` directory
- [ ] Create `skills/review/SKILL.md` with frontmatter and router logic
- [ ] Create `skills/review/references/report-format.md`
- [ ] Create `skills/review/references/lenses/architecture.md`
- [ ] Create `skills/review/references/lenses/correctness.md`
- [ ] Create `skills/review/references/lenses/security.md`
- [ ] Create `skills/review/references/lenses/quality.md`
- [ ] Create `skills/review/references/lenses/testing.md`
- [ ] Create `skills/review/references/lenses/dependencies.md`
- [ ] Create `skills/review/README.md`
- [ ] Run this repository's local validation for skill/docs changes, if available
- [ ] Smoke test: invoke `/skill:review` on a real diff

## 10. Open questions

None — decisions resolved during brainstorming:

| Question | Resolution |
|---|---|
| Self-review / Ralph Wiggum Loop? | Deferred. Not part of this skill. |
| Sub-agent orchestration? | Deferred. Skill defines methodology only. |
| "Solve it better" suggestions? | Off by default. Only on explicit request or concrete structural problem. |
| Lens granularity? | Separate files. Progressive disclosure via index table. |
| Staged + unstaged changes both present? | Ask the user which scope to review if the request is ambiguous. |
