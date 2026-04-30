# Skill taxonomy refinement and reference normalization — Implementation plan

Status: Completed
Owner: agent
Created: 2026-04-30
Spec: [[docs/specs/2026-04-30-skill-taxonomy-refinement-and-reference-normalization.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Refine the skill catalog so methodology skills live under `engineering`, meta-workflow skills under `productivity`, and integration/operator skills under `tools`, then normalize repository docs to use those current references consistently.

## Progress

- [x] (2026-04-30 12:00 local) Created spec and execution plan artifacts.
- [x] (2026-04-30 12:34 local) Moved `github`, `browser`, and `youtube-transcript` into `skills/tools/` and removed the retired `research` category.
- [x] (2026-04-30 12:35 local) Updated category READMEs and top-level taxonomy docs.
- [x] (2026-04-30 12:36 local) Normalized current and historical doc references to current categorized skill paths.
- [x] (2026-04-30 12:37 local) Ran `bun run check:docs`, `bun run check:boundaries`, `bun run test`, and `bun run check`.

## Surprises & discoveries

- Observation: A blind replacement pass can accidentally rewrite historical move examples into nonsense if old and new categorized paths overlap semantically.
  Evidence: the first normalization pass produced incorrect examples in `2026-04-30-legacy-skill-categorization.md`, which then needed targeted correction.

- Observation: Pi's recursive skill discovery made taxonomy refinement a pure repo-layout and documentation change.
  Evidence: no `package.json` manifest edits were required, and docs + test validation still passed after the directory moves.

- Observation: Full `bun run check` is still blocked only by previously known Biome formatting issues in unrelated `extensions/dayjob/*` files.
  Evidence: rerunning `bun run check` failed only in `check:biome` on the same four `extensions/dayjob/*` files.

## Decision log

- Decision: Replace `research` with `tools`.
  Rationale: the affected skills are better described by the interfaces they operate than by a single research-oriented use case.
  Date/Author: 2026-04-30 / agent

## Outcomes & retrospective

Completed outcomes:
- refined the top-level skill taxonomy to `engineering`, `productivity`, and `tools`
- moved `github` from `engineering` to `tools`
- replaced the temporary `research` category with `tools`
- moved `browser` and `youtube-transcript` under `skills/tools/`
- added `skills/tools/README.md`
- normalized current and historical docs to current categorized paths where practical

What worked well:
- the taxonomy is now cleaner: methodologies, productivity workflows, and integrations are separated
- preserving skill basenames kept skill identity stable while allowing directory-level reclassification
- repository-authored docs were straightforward to normalize with a controlled scripted pass followed by targeted cleanup

Remaining follow-up:
- some historical docs still mention removed legacy precursor skills like `skills/commit/` or `skills/pr-review/` when discussing deleted source material; these are historical references rather than current navigation targets
- full `bun run check` remains blocked by unrelated `extensions/dayjob/*` formatting drift

## Context and orientation

Likely files:
- `skills/engineering/README.md`
- `skills/productivity/README.md`
- `skills/tools/README.md`
- `docs/ARCHITECTURE.md`
- `README.md`
- `AGENTS.md`
- historical specs and exec plans mentioning old paths

## Plan of work

1. Move the integration-oriented skills into a new `tools` category.
2. Update category docs to match the refined taxonomy.
3. Run a controlled normalization pass on repository-authored docs.
4. Validate and record results.

## Concrete steps

- move directories
- update docs and READMEs
- run `rg` verification searches
- run `bun run check:docs`
- run `bun run check:boundaries`
- run `bun run test`
- run `bun run check`

## Validation and acceptance

The work is complete when current and historical docs point at the categorized paths, the catalog reads coherently by category, and validation passes except for any documented unrelated blockers.

## Idempotence and recovery

Directory moves and text edits are reversible via git. No runtime state or package manifest changes are needed.

## Artifacts and notes

This is a follow-up to:
- `2026-04-30-skill-imports-and-classified-catalog`
- `2026-04-30-legacy-skill-categorization`

## Interfaces and dependencies

No runtime interface changes are expected. The main contract is repository navigation and path stability in documentation.
