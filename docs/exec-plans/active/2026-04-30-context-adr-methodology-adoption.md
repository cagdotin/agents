# Context/ADR methodology adoption — Implementation plan

Status: Active
Owner: agent
Created: 2026-04-30
Spec: [[docs/specs/2026-04-30-context-adr-methodology-adoption.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Document the missing skills and support artifacts needed to make the `CONTEXT.md` + ADR + engineering-skill methodology usable across downstream repositories that inherit this package.

## Progress

- [x] (2026-04-30 12:00 local) Reviewed Matt Pocock engineering skills and compared them with the package's current skill catalog.
- [x] (2026-04-30 12:00 local) Identified essential missing skills, adaptations, and rollout phases.
- [x] (2026-04-30 12:00 local) Wrote the recommendation spec and this execution plan.

## Surprises & discoveries

- Observation: the package already has stronger planning primitives than Matt's `to-prd` workflow because `docs/specs/` and `docs/exec-plans/` are already first-class conventions here.
  Evidence: repo guidance in `AGENTS.md`, `docs/exec-plans/README.md`, and `skills/engineering/plan/SKILL.md` already standardizes spec + execution-plan usage.

- Observation: the most important missing piece is not just more skills, but a repo bootstrap skill that teaches those skills where context docs, ADRs, and issue-tracker settings live.
  Evidence: several upstream skills assume prior configuration and shared repo-local metadata.

## Decision log

- Decision: recommend adaptation rather than verbatim import for the setup/bootstrap and PRD-oriented skills.
  Rationale: this package has different conventions, naming, and planning artifacts than the upstream repo.
  Date/Author: 2026-04-30 / agent

## Outcomes & retrospective

This plan captures the gap analysis and recommended roadmap. Implementation is still pending.

## Context and orientation

Reference surfaces:
- `skills/engineering/README.md`
- `skills/tools/README.md`
- `skills/productivity/README.md`
- `skills/engineering/plan/SKILL.md`
- upstream engineering skills in `mattpocock/skills`

## Plan of work

1. Compare current catalog against the upstream methodology set.
2. Classify gaps into foundation, execution discipline, and issue workflow.
3. Record a rollout recommendation that fits this package's conventions.

## Concrete steps

- inspect upstream engineering skills
- compare against current categorized catalog
- write spec + plan artifacts

## Validation and acceptance

Acceptance means the repo has a committed design record explaining which skills are still missing, which should be adapted, and how they fit with `CONTEXT.md`, ADRs, specs, and exec plans.

## Idempotence and recovery

Docs-only analysis. Safe to revise or supersede with later implementation specs.

## Artifacts and notes

Recommended high-priority additions:
- `grill-with-docs`
- adapted setup/bootstrap skill
- `zoom-out`
- `diagnose`
- `tdd`
- `triage`
- `to-issues`

## Interfaces and dependencies

No runtime dependencies yet. Future implementation will touch only skill markdown, docs, and perhaps templates under a new references directory.
