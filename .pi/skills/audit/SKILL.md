---
name: audit
description: Audit this repository for documentation freshness and code design quality. Produces a structured report. Use when asked to audit, health check, review code quality, check design health, or do a maintenance pass.
---

# Audit

Audit the repository across documentation and code quality concerns.
Output is a **report** — present findings to the user. Do not commit, refactor, or fix unless explicitly told to.

## When to use

- The user asks to "audit", "health check", "check docs", or "review code quality"
- Starting a maintenance or housekeeping session
- After a batch of work that touched multiple extensions, skills, or docs
- Before or after a significant refactor to assess where things stand
- Periodically, as a design and documentation hygiene check

## Workflow

1. **Determine the audit scope.** Use explicit user input first. If ambiguous, default to both lenses repo-wide. The user may ask for just one lens or just one extension — respect that.
2. **Load the relevant lenses.** Default to all lenses unless the user asks for a narrower audit.
3. **Gather context before judging.** Read source files, docs, tests, and READMEs as needed. For docs-freshness, run `bun run audit` first.
4. **Focus on judgment, not mechanics.** Don't flag style issues that Biome catches. Don't report on principles that don't apply to the scope.
5. **Produce the report using `references/report-format.md`.** Group findings by lens. Omit empty lenses.

## Available lenses

| Lens | Use when auditing for | Reference |
|---|---|---|
| Docs Freshness | stale docs, missing entries, structural drift, metadata honesty | `references/lenses/docs-freshness.md` |
| Design Principles | modularity, separation, clarity, composition, and other Unix philosophy principles | `references/lenses/design-principles.md` |

The design-principles lens is based on Eric Raymond's Unix philosophy. Full source: `docs/resources/unix-philosophy-raymond.md`.

## Audit notes

- State the scope and lenses before presenting findings.
- Prefer concrete findings over generic advice.
- Distinguish clearly between errors (provably wrong), concerns (design smell), and notes (minor).
- When a finding depends on missing context, say what would need to be checked.
- If no issues are found for a lens, omit that lens from the report.
- Do not commit or push — this skill produces a report, not a commit.
