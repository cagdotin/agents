# Phase 1 context/ADR foundation skills — Implementation plan

Status: Completed
Owner: agent
Created: 2026-04-30
Spec: [[docs/specs/2026-04-30-phase-1-context-adr-foundation-skills.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Add the three foundational skills that make the shared `CONTEXT.md` + ADR methodology operational across downstream repositories: `grill-with-docs`, `setup-repo-methodology`, and `zoom-out`.

## Progress

- [x] (2026-04-30 00:00 local) Created spec and execution plan artifacts.
- [x] (2026-04-30 13:30 local) Added shared engineering references for `CONTEXT.md` and ADR formatting under `skills/engineering/references/`.
- [x] (2026-04-30 13:30 local) Added `skills/engineering/grill-with-docs/`.
- [x] (2026-04-30 13:31 local) Added `skills/engineering/setup-repo-methodology/` and support files.
- [x] (2026-04-30 13:31 local) Added `skills/engineering/zoom-out/`.
- [x] (2026-04-30 13:31 local) Updated `skills/engineering/README.md`, `skills/engineering/improve-codebase-architecture/SKILL.md`, and `docs/QUALITY.md`.
- [x] (2026-04-30 13:32 local) Ran `bun run check:docs`, `bun run check:boundaries`, `bun run test`, and `bun run check`.

## Surprises & discoveries

- Observation: `improve-codebase-architecture` already carried local copies of context and ADR guidance, so the cleanest way to add `grill-with-docs` was to centralize those files into shared engineering references.
  Evidence: `improve-codebase-architecture/SKILL.md` previously linked to local `context-format.md` and `adr-format.md`, both of which were moved into `skills/engineering/references/`.

- Observation: the adapted setup skill can stay highly portable without runtime code because issue-tracker choice and domain-doc layout can be expressed entirely as repo-local markdown docs under `docs/agents/`.
  Evidence: the imported bootstrap workflow only needed markdown support templates and target-file selection rules.

- Observation: full `bun run check` remains blocked only by the previously known Biome formatting issues in unrelated `extensions/dayjob/*` files.
  Evidence: `bun run check` failed in `check:biome` on the same four `extensions/dayjob/*` files and did not report new issues from the added skills.

## Decision log

- Decision: extract `context-format` and `adr-format` into shared engineering references.
  Rationale: both `improve-codebase-architecture` and `grill-with-docs` need them, and future methodology skills likely will too.
  Date/Author: 2026-04-30 / agent

## Outcomes & retrospective

Completed outcomes:
- added `skills/engineering/grill-with-docs/`
- added `skills/engineering/setup-repo-methodology/`
- added `skills/engineering/zoom-out/`
- added shared engineering references for `context-format` and `adr-format`
- updated `improve-codebase-architecture` to consume the shared references
- updated the engineering category index

What worked well:
- the new skills fit naturally into the existing `engineering` category without taxonomy changes
- centralizing shared references reduced future duplication for upcoming methodology skills like `diagnose` and `tdd`
- the setup skill could be adapted cleanly from upstream while preserving this package's AGENTS-only preference and multi-repo portability

Remaining follow-up:
- Phase 2 methodology skills (`diagnose`, `tdd`) are still pending
- Phase 3 issue-workflow skills (`triage`, `to-issues`, and any `to-prd` replacement) are still pending
- full `bun run check` remains blocked by unrelated `extensions/dayjob/*` formatting drift

## Context and orientation

Primary files:
- `skills/engineering/improve-codebase-architecture/SKILL.md`
- `skills/engineering/README.md`
- upstream `grill-with-docs`, `setup-matt-pocock-skills`, and `zoom-out` skill files

## Plan of work

1. Centralize reusable context/ADR references.
2. Add the new skills with package-appropriate naming and wording.
3. Update the engineering category index.
4. Validate.

## Concrete steps

- write new shared reference files
- write new skill folders and support markdown
- update existing skill links
- run `bun run check:docs`
- run `bun run check:boundaries`
- run `bun run test`
- run `bun run check`

## Validation and acceptance

The work is complete when the three new skills exist, shared references resolve correctly, and repo validation passes except for documented unrelated blockers.

## Idempotence and recovery

This is all file creation and text edits. Reversible with git. No runtime state changes involved.

## Artifacts and notes

This implements Phase 1 from `2026-04-30-context-adr-methodology-adoption`.

## Interfaces and dependencies

No runtime dependencies. The contract is skill structure, relative reference validity, and documentation clarity.
