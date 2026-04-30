# Legacy skill categorization — Implementation plan

Status: Completed
Owner: agent
Created: 2026-04-30
Spec: [[docs/specs/2026-04-30-legacy-skill-categorization.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Finish the classified skill catalog by moving the older flat skills into category directories while preserving recursive Pi discovery and stable skill names.

## Progress

- [x] (2026-04-30 12:00 local) Created spec and execution plan artifacts.
- [x] (2026-04-30 12:24 local) Moved legacy engineering skills into `skills/engineering/` (`plan`, `review`).
- [x] (2026-04-30 12:24 local) Moved legacy tool/integration skills into categorized directories (`github`, `browser`, `youtube-transcript`).
- [x] (2026-04-30 12:25 local) Updated category index READMEs, stable doc references, and moved browser README path examples.
- [x] (2026-04-30 12:26 local) Ran `bun run check:docs`, `bun run check:boundaries`, `bun run test`, and `bun run check`.

## Surprises & discoveries

- Observation: Moving skill directories did not require any package manifest changes because Pi already discovers skill roots recursively beneath the existing `skills/` manifest entry.
  Evidence: the package manifest still points at `./skills`, and `bun run check:docs` passed after the moves.

- Observation: The only skill-local README that needed a path fix after the move was `browser/README.md`.
  Evidence: `rg` across current docs and skills found stale operational paths only in the browser README and plan-path references in current docs.

- Observation: `bun run check` is still blocked only by the previously known Biome formatting issues in unrelated `extensions/dayjob/*` files.
  Evidence: rerunning `bun run check` failed in `check:biome` on the same four `extensions/dayjob/*` files and did not report new skill-layout-related failures.

## Decision log

- Decision: The initial split separated methodology-heavy skills from browser/transcript gathering workflows.
  Rationale: It created a first-pass category structure without broad churn. A later follow-up refined this further into the current `tools` category.
  Date/Author: 2026-04-30 / agent

## Outcomes & retrospective

Completed outcomes:
- moved `plan` and `review` into `skills/engineering/`
- moved `github`, `browser`, and `youtube-transcript` into categorized package-skill directories
- expanded `skills/engineering/README.md`
- added category README coverage for the moved skills
- updated stable planning references to `skills/engineering/plan/PLAN.md`
- updated browser setup docs to the categorized path

What worked well:
- recursive skill discovery made the move mostly a documentation and layout exercise rather than a runtime change
- preserving skill basenames kept `name:` frontmatter and `/skill:name` compatibility intact
- the first-pass split made later taxonomy refinement straightforward

Remaining follow-up:
- this plan's first-pass taxonomy was later refined by `2026-04-30-skill-taxonomy-refinement-and-reference-normalization`
- full `bun run check` remains blocked by unrelated `extensions/dayjob/*` formatting drift

## Context and orientation

Likely files to touch:
- `AGENTS.md`
- `README.md`
- `docs/exec-plans/README.md`
- `docs/exec-plans/TEMPLATE.md`
- `docs/exec-plans/active/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- `skills/engineering/README.md`
- `skills/tools/README.md`
- moved skill READMEs under `browser`, `plan`, `review`, `github`, `youtube-transcript`

## Plan of work

1. Move the legacy skill directories into their category parents.
2. Update stable docs that point to moved skill paths.
3. Add or expand category index READMEs.
4. Run validation commands and capture outcomes.

## Concrete steps

- Move directories with shell commands
- Edit current docs and skill READMEs
- Run `bun run check:docs`
- Run `bun run check:boundaries`
- Run `bun run test`

## Validation and acceptance

The work is complete when the top-level package skills are consistently categorized, validation passes, and no active operational docs point at the old flat legacy skill paths.

## Idempotence and recovery

Moves are reversible with `git checkout -- skills` plus restoration of doc edits. No runtime migrations or generated state changes are involved.

## Artifacts and notes

This is a follow-up to `2026-04-30-skill-imports-and-classified-catalog`.

## Interfaces and dependencies

No runtime interface changes are expected. The main change is repository layout and associated documentation paths.
