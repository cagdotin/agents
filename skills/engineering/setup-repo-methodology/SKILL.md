---
name: setup-repo-methodology
description: Sets up repo-local methodology docs so shared engineering skills know this repo's issue tracker, triage label vocabulary, and domain doc layout. Run before first use of `grill-with-docs`, `zoom-out`, `improve-codebase-architecture`, future issue-workflow skills, or whenever those skills appear to be missing repo-local context.
---

# Setup repo methodology

Scaffold the per-repo configuration that the shared engineering skills assume:

- **Issue tracker** — where issues live (GitHub by default; GitLab, local markdown, and custom workflows are also supported)
- **Triage labels** — the strings used for the canonical triage roles
- **Domain docs** — where `CONTEXT.md`, `CONTEXT-MAP.md`, and ADRs live, and how skills should consume them

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Inspect the current repo before making assumptions:

- `git remote -v` and `.git/config` — is there a remote, and is it GitHub, GitLab, or something else?
- `AGENTS.md` at the repo root — does it exist? Is there already an `## Agent skills` section?
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/` — does prior setup already exist?
- `.scratch/` — signal that local-markdown issue tracking may already be in use

### 2. Present findings and ask

Summarize what exists and what is missing. Then walk the user through these decisions **one at a time**. Present a section, get the answer, then continue.

Assume the user may not know the terminology. Each section starts with a short explainer.

#### Section A — Issue tracker

Explain: the issue tracker is where work items live. Skills that create or read issues need to know whether to call `gh`, `glab`, write markdown files, or follow some other workflow.

Default posture:
- if `git remote` clearly points at GitHub, propose GitHub
- if `git remote` clearly points at GitLab, propose GitLab
- otherwise offer GitHub, GitLab, local markdown, or custom workflow

Choices:
- **GitHub** — use the `gh` CLI
- **GitLab** — use the `glab` CLI
- **Local markdown** — store issues under `.scratch/<feature>/`
- **Other** — ask the user to describe the workflow in one paragraph and record it as freeform instructions

#### Section B — Triage label vocabulary

Explain: issue workflow skills refer to canonical roles like `needs-triage` and `ready-for-agent`, but the actual labels in a repo may differ.

Canonical roles:
- `needs-triage`
- `needs-info`
- `ready-for-agent`
- `ready-for-human`
- `wontfix`

Default: each role maps to itself unless the user wants overrides.

#### Section C — Domain docs

Explain: engineering methodology skills read `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/` so they can use the repo's language and respect past architectural decisions.

Confirm the layout:
- **Single-context** — one root `CONTEXT.md` and `docs/adr/`
- **Multi-context** — one root `CONTEXT-MAP.md` plus per-context `CONTEXT.md` files and possibly context-local ADR directories

### 3. Confirm and edit

Show the user a draft of:

- the `## Agent skills` block to add to `AGENTS.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`
- `docs/agents/domain.md`

Let the user edit before writing.

### 4. Write

#### Pick the file to edit

- If `AGENTS.md` exists, edit it.
- If it does not exist, create `AGENTS.md`.

Do not create or update any alternate root agent-instruction file.

If an `## Agent skills` block already exists in `AGENTS.md`, update it in place instead of appending a duplicate.

Use this block shape:

```md
## Agent skills

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Triage labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of the context/ADR layout]. See `docs/agents/domain.md`.
```

Then write the docs under `docs/agents/` using these templates as starting points:

- [issue-tracker-github.md](./issue-tracker-github.md)
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md)
- [issue-tracker-local.md](./issue-tracker-local.md)
- [triage-labels.md](./triage-labels.md)
- [domain.md](./domain.md)

For a custom issue tracker, write `docs/agents/issue-tracker.md` from scratch using the user's description.

### 5. Done

Tell the user setup is complete and mention that shared engineering skills can now use these repo-local docs. Also mention that users can edit `docs/agents/*.md` directly later if the workflow changes.
