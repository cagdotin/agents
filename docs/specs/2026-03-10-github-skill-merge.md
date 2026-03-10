# GitHub Skill — Merge commit + pr-review + github into One Skill

Status: Draft
Date: 2026-03-10
Execution plan: [[docs/exec-plans/active/2026-03-10-github-skill-merge.md]]

## 1. Problem statement

Three separate skills — `github`, `pr-review`, and `commit` — cover closely related git/GitHub workflows. This means:

- Three skill descriptions occupy system prompt context instead of one.
- There's no shared context between them (e.g., "always use `--repo owner/repo`" appears only in `github`).
- The agent must decide between three skills for related tasks, which can lead to loading the wrong one or not loading any.
- `pr-review` contains review methodology that belongs in the new `review` skill — once extracted, what remains is GitHub ceremony (fetch PR, format verdict) that naturally fits inside a unified github skill.

The project needs a single `github` skill with progressive disclosure: a short router SKILL.md that directs the agent to the right reference file based on the task.

## 2. Goals and non-goals

### 2.1 Goals

- Merge `commit`, `pr-review`, and `github` into a single `skills/github/` skill.
- SKILL.md becomes a router (~30-40 lines) with a decision tree pointing to reference files.
- Reference files:
  - `references/commit.md` — conventional commits workflow (from current `commit/SKILL.md`)
  - `references/pr-review.md` — PR-specific flow: fetch, review, verdict (trimmed; review methodology delegates to `/skill:review`)
  - `references/gh-cli.md` — gh CLI patterns for issues, CI, API (from current `github/SKILL.md`)
- `pr-review.md` cross-references the `review` skill for thorough analysis.
- Delete `skills/commit/` and `skills/pr-review/` directories after merge.
- Treat any runtime skill-registry or prompt-template updates as out-of-repo follow-up unless a repo-local source-of-truth file actually exists.
- Single description triggers for all three use cases: committing, PR workflows, and general GitHub interaction.

### 2.2 Non-goals

- **Creating the review skill** — that's a separate spec/plan (`2026-03-10-review-skill`).
- **Changing commit format or conventions** — content migrates as-is.
- **Adding new GitHub functionality** — this is a restructure, not a feature addition.
- **Runtime code changes** — skills are static markdown.

## 3. System context

### Affected modules

- `skills/github/` — existing skill, will be restructured with references/ directory
- `skills/commit/` — will be deleted (content moves to `github/references/commit.md`)
- `skills/pr-review/` — will be deleted (GitHub ceremony moves to `github/references/pr-review.md`, review methodology lives in the `review` skill)
- Runtime skill registry / harness prompt templates — may need follow-up outside this repository if the merged skill list is maintained elsewhere

### Dependencies

- **Depends on**: the `review` skill should exist (or at least be planned) before `pr-review.md` can reference it. If the review skill isn't built yet, `pr-review.md` should include an inline fallback checklist with a note that it will be replaced by `/skill:review`.
- **Ordering**: ideally build the review skill first, then do this merge.

### Conventions

Same Pi skill conventions as the review skill spec (frontmatter, kebab-case, etc.).

## 4. Detailed design

### 4.1 SKILL.md (the router)

Short decision tree:

```
Committing code?           → read references/commit.md
Reviewing a PR?            → read references/pr-review.md
GitHub CLI (issues, CI, API)? → read references/gh-cli.md
```

Shared context that applies to all workflows (e.g., `--repo owner/repo` when not in a git directory) lives directly in the SKILL.md router.

### 4.2 references/commit.md

Direct migration from current `skills/commit/SKILL.md` body (everything below frontmatter). No content changes needed.

### 4.3 references/gh-cli.md

Direct migration from current `skills/github/SKILL.md` body. No content changes needed.

### 4.4 references/pr-review.md

This is the one that changes structurally:

**Keeps** (GitHub-specific ceremony):
- Parse PR URL
- Fetch PR metadata via `gh pr view`
- Fetch the diff via `gh pr diff`
- Claims vs Reality section
- Verdict section (Approve / Request Changes / Comment)

**Delegates** (to `/skill:review`):
- The actual code analysis. Instead of the inline review checklist table, pr-review.md says: "Load `/skill:review` and apply it to the PR diff. Use the report format from the review skill."
- If the review skill is not available, include a minimal inline fallback: "At minimum, review for correctness, security, and breaking changes."

**Removes**:
- The full 14-row review checklist table (now lives as lenses in the review skill)

### 4.5 Runtime skill-list update

If the runtime environment maintains a separate skill registry or prompt-template skill list, it should be updated after the merge to remove `commit` and `pr-review` and broaden `github` accordingly.

This repository may not contain that source-of-truth file directly. During implementation, verify whether a repo-local file actually owns the runtime skill list before planning an in-repo edit.

### 4.6 Frontmatter

```yaml
name: github
description: "Git and GitHub workflows: conventional commits, PR review, CI status, issues, and gh CLI. Load when committing code, creating or reviewing pull requests, checking CI, or interacting with GitHub."
```

## 5. Testing strategy

### 5.1 Validation

- `bun run check:docs` passes at minimum
- `bun run check` is preferred when the working tree is otherwise clean
- All relative paths in SKILL.md resolve to actual files
- Smoke test: `/skill:github` loads, agent follows router to the correct reference based on task

### 5.2 No unit tests

Skills are markdown.

## 6. Implementation checklist

- [ ] Create `skills/github/references/` directory
- [ ] Create `skills/github/references/commit.md` (migrate from `commit/SKILL.md`)
- [ ] Create `skills/github/references/gh-cli.md` (migrate from current `github/SKILL.md` body)
- [ ] Create `skills/github/references/pr-review.md` (restructured, delegates to review skill)
- [ ] Rewrite `skills/github/SKILL.md` as router with updated frontmatter
- [ ] Update or create `skills/github/README.md`
- [ ] Delete `skills/commit/`
- [ ] Delete `skills/pr-review/`
- [ ] Update any out-of-repo runtime skill registry, if applicable
- [ ] Run `bun run check:docs`
- [ ] Optionally run `bun run check` when the working tree is otherwise clean
- [ ] Smoke test: invoke `/skill:github` for commit, PR review, and general gh tasks

## 7. Open questions

| Question | Resolution |
|---|---|
| Skill name: `github` or `git`? | `github` — the gh CLI and PR workflows are GitHub-specific. Commit format is git-generic but fits naturally here. |
| Build order: review first or github merge first? | Review first is preferred so pr-review.md can reference it immediately. But a fallback clause handles the case where review doesn't exist yet. |
