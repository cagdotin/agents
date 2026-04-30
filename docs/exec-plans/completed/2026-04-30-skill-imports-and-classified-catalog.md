# Skill imports and classified catalog — Implementation plan

Status: Completed
Owner: agent
Created: 2026-04-30
Spec: [[docs/specs/2026-04-30-skill-imports-and-classified-catalog.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Add four requested skills from `mattpocock/skills` and introduce an initial categorized package-skill layout under `skills/engineering/` and `skills/productivity/`, while keeping Pi compatibility and local docs validation intact.

## Progress

- [x] (2026-04-30 00:00 local) Created spec and execution plan artifacts.
- [x] (2026-04-30 12:18 local) Updated `scripts/validate-docs.ts` to discover skill directories recursively while skipping category containers, hidden directories, and `node_modules`.
- [x] (2026-04-30 12:19 local) Added nested-skill coverage to `scripts/__tests__/validate-docs.test.ts`.
- [x] (2026-04-30 12:19 local) Imported `caveman`, `grill-me`, and `write-a-skill` under `skills/productivity/`.
- [x] (2026-04-30 12:19 local) Imported `improve-codebase-architecture` plus local support references under `skills/engineering/`.
- [x] (2026-04-30 12:19 local) Added category index READMEs and updated repo docs for grouped skills.
- [x] (2026-04-30 12:20 local) Ran validation: `bun run check:docs`, `bun run check:boundaries`, `bun run test`, and a focused validator test run all passed.
- [x] (2026-04-30 12:20 local) Verified `bun run check` is still blocked by pre-existing Biome issues in unrelated `extensions/dayjob/*` files.

## Surprises & discoveries

- Observation: The local QMD config references an `agents` collection, but the collection is not currently present in the active QMD index.
  Evidence: `qmd query -c agents ...` returned `Collection not found: agents`, while `qmd status` listed only `yilmaz` and `meister`.

- Observation: Pi package docs explicitly support recursive discovery of skill directories containing `SKILL.md` under `skills/`.
  Evidence: `docs/packages.md` in the installed Pi docs states that `skills/` recursively finds `SKILL.md` folders.

- Observation: `bun run check` currently fails before reaching docs or tests because Biome reports formatting issues in unrelated `extensions/dayjob/*` files that were already dirty in the working tree.
  Evidence: `bun run check` failed in `check:biome` on `extensions/dayjob/__tests__/detect.test.ts`, `extensions/dayjob/config.ts`, `extensions/dayjob/constants.ts`, and `extensions/dayjob/index.ts`; `git status --short` also showed multiple pre-existing `extensions/dayjob/*` modifications.

## Decision log

- Decision: Introduce categorized directories only for the newly imported skills in this change.
  Rationale: It satisfies the requested classification pattern without creating a broad migration of existing skill paths and documentation references.
  Date/Author: 2026-04-30 / agent

- Decision: Adapt imported support files to kebab-case and local relative links.
  Rationale: Repository naming rules matter more than path fidelity to upstream; preserving broken or style-violating names would create avoidable drift.
  Date/Author: 2026-04-30 / agent

## Outcomes & retrospective

Implemented the requested skill import and initial classification pass.

Completed outcomes:
- added `skills/productivity/caveman/`
- added `skills/productivity/grill-me/`
- added `skills/productivity/write-a-skill/`
- added `skills/engineering/improve-codebase-architecture/` with local support references
- added category README indexes under `skills/productivity/` and `skills/engineering/`
- updated docs validation to support categorized skill directories
- updated repository docs to acknowledge grouped package skills

What worked well:
- Pi already supports recursive `SKILL.md` discovery, so the structure change needed only local validator and doc updates.
- Keeping category READMEs nested avoided accidental top-level `.md` skill loading under `skills/`.
- Adapting support file names to kebab-case let the imported content fit local conventions cleanly.

Remaining follow-up opportunities:
- decide later whether legacy flat skills should also migrate into category directories
- restore or re-index the missing local QMD `agents` collection if semantic doc search should be relied on again
- clean up the unrelated `extensions/dayjob/*` formatting drift so `bun run check` is green end-to-end

## Context and orientation

Relevant files and docs:
- `docs/specs/2026-04-30-skill-imports-and-classified-catalog.md`
- `scripts/validate-docs.ts`
- `scripts/__tests__/validate-docs.test.ts`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/QUALITY.md`
- `skills/`

## Plan of work

1. Change docs validation to discover skills recursively while skipping category containers and dependency directories.
2. Extend validator tests with at least one categorized nested skill fixture.
3. Add `skills/productivity/` and `skills/engineering/` directories, category READMEs, and the requested skill files.
4. Adapt imported skill content so every referenced file exists locally and harness-specific assumptions are not false.
5. Update repository docs to acknowledge the categorized skill layout.
6. Run checks, record results, and move this plan to completed if work finishes in-session.

## Concrete steps

- Edit `scripts/validate-docs.ts`
- Edit `scripts/__tests__/validate-docs.test.ts`
- Write new files under `skills/productivity/` and `skills/engineering/`
- Edit `README.md`, `docs/ARCHITECTURE.md`, and `docs/QUALITY.md` as needed
- Run `bun run check:docs`
- Run `bun run check`

## Validation and acceptance

Acceptance means:
- the four requested skills exist in categorized directories
- every referenced support markdown file exists locally
- `bun run check:docs` passes
- repo checks pass or any blocker is documented explicitly

## Idempotence and recovery

Most work is additive or direct file edits. If a specific imported skill needs to be reverted, remove its directory and restore validator/docs edits from git.

## Artifacts and notes

- Upstream source: `mattpocock/skills`
- Local compatibility note: recursive package-skill discovery is supported by Pi, but this repo's validator needed to catch up.

## Interfaces and dependencies

- No runtime dependency changes are expected.
- The main contract change is local documentation validation behavior for `skills/`.
