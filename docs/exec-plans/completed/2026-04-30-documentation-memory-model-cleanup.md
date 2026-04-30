# Documentation memory model cleanup

Status: Completed
Owner: agent
Created: 2026-04-30
Spec: [[docs/specs/2026-04-30-documentation-memory-model-cleanup.md]]
Issue: #1

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Reshape the repository documentation and validation tooling around the accepted memory model so agents and humans have fewer, clearer entry points. After this change, obsolete docs are gone, routing docs no longer overlap heavily, coding conventions have a dedicated home, and structural validation enforces the new model.

## Progress

- [x] (2026-04-30 00:00 local) Grilled the target documentation model, recorded glossary decisions in `CONTEXT.md`, created ADR 0001, and opened umbrella issue #1.
- [x] (2026-04-30 15:46 local) Created the implementation spec + active plan for the cleanup and updated the active plan index.
- [x] (2026-04-30 15:46 local) Rewrote the core entry surfaces and stable docs for the new routing model.
- [x] (2026-04-30 15:46 local) Updated planning/reference/onboarding surfaces and moved the conditional feature reference next to its owner.
- [x] (2026-04-30 15:46 local) Replaced audit-specific tooling with structural validation checks, deleted obsolete docs/categories, and ran validation.

## Surprises & discoveries

- Observation: the current repo had broad dependency on `docs/QUALITY.md` and `docs/CONTRIBUTING-DOCS.md` across docs, skills, onboarding, and audit tooling.
  Evidence: repository-wide search during the grilling session found references in `AGENTS.md`, `README.md`, `docs/*`, `skills/engineering/plan/SKILL.md`, `extensions/qmd/domain/onboarding.ts`, `scripts/audit-docs.ts`, and audit tests.

- Observation: the useful part of the retired audit surface was the exec-plan indexing/status logic, which fit naturally inside `check:docs`.
  Evidence: the replacement `scripts/validate-docs.ts` now enforces active/completed plan indexing and rejects completed plans left in `active/` while all checks still pass under `bun run check`.

## Decision log

- Decision: keep specs and exec plans for now, but narrow them to genuinely complex, multi-session, or architecture-shaping work.
  Rationale: the current workflow and skills still depend on them, but GitHub should remain the canonical backlog.
  Date/Author: 2026-04-30 / agent + user

- Decision: move useful structural checks into `scripts/validate-docs.ts` and remove the separate audit surface.
  Rationale: the target model prefers fewer surfaces and rejects narrative/freshness theater.
  Date/Author: 2026-04-30 / agent + user

## Outcomes & retrospective

The cleanup landed as one coordinated pass: new routing docs now point to the memory-model categories, coding conventions have a dedicated doc, owned conditional-feature docs moved next to `lib/extension-runtime/`, obsolete docs/categories were deleted, and documentation enforcement now lives in `scripts/validate-docs.ts` instead of a separate audit script. Historical completed plans/specs still mention retired surfaces in places, but active routing and tooling no longer depend on them.

## Context and orientation

The active routing surfaces are `README.md`, `AGENTS.md`, `docs/README.md`, and `docs/ARCHITECTURE.md`. The new memory model is recorded in `CONTEXT.md` and ADR 0001. Validation now lives entirely in `scripts/validate-docs.ts`; the old audit script/tests are gone. Historical plan/spec docs can remain mostly untouched unless they affect active routing or validation.

## Plan of work

1. Create the planning artifacts and update plan indexes so the work follows repo policy.
2. Rewrite the entry surfaces and stable docs to match the memory model and remove references to retired docs.
3. Update planning/readme/onboarding/reference surfaces so they no longer route to obsolete categories and so owned references move next to their owner.
4. Replace the audit tooling with stronger structural validation, then delete obsolete files/directories and clean up tests/scripts.
5. Run repo checks and capture outcomes.

## Concrete steps

From repo root:
- inspect active docs and dependencies with `rg`
- edit docs and scripts
- run `bun run check:docs`
- run `bun run check:boundaries`
- run `bun run test`

## Validation and acceptance

Success means:
- no active routing surface points to `docs/QUALITY.md`, `docs/CONTRIBUTING-DOCS.md`, or `docs/reports/`
- `docs/coding-conventions.md` exists and stable style rules point there
- `scripts/validate-docs.ts` enforces the new structural rules
- `scripts/audit-docs.ts` and its tests are removed
- repo checks/tests pass

## Idempotence and recovery

Docs/script edits are safe to re-run. If a validation change breaks expectations, restore the failing rule before deleting the obsolete file it protected. Delete obsolete docs only after their incoming references have been rerouted.

## Artifacts and notes

- Umbrella issue: `#1`
- ADR: `docs/adr/0001-documentation-memory-model.md`
- Validation proof: `bun run check`

## Interfaces and dependencies

- `package.json` script entries must stay aligned with existing scripts.
- `skills/engineering/plan/SKILL.md` and `docs/exec-plans/*` must agree on when planning artifacts are required.
- `extensions/qmd/domain/onboarding.ts` must reflect the new doc entry surfaces.
