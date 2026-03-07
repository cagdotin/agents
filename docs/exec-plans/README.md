# Execution Plans

Execution plans are the **operational layer** for non-trivial work:
- sequencing implementation
- recording decisions
- logging progress/blockers
- tracking completion criteria

## Structure

- `active/` — in-progress or queued plans
- `completed/` — finished plans with outcome references
- `tech-debt-tracker.md` — debt register with priority and remediation links
- `TEMPLATE.md` — baseline plan structure

Execution-plan authoring standard: `skills/plan/PLAN.md` (portable skill-local standard)

## Spec vs execution plan (why both exist)

These are intentionally separate categories:

- `docs/specs/` = design contract (**what/why/how**)
- `docs/exec-plans/` = execution state (**when/order/status/decisions during rollout**)

A nested `docs/exec-plans/specs/` folder is not required. Separation by purpose keeps the lifecycle clear:
- specs are mostly stable once approved
- execution plans are living logs updated during implementation

## Recommended workflow

**Policy:** for medium/large initiatives, create both a spec and an execution plan unless explicitly waived by the user.

1. Create a spec in `docs/specs/`.
2. Create an execution plan in `docs/exec-plans/active/` and link the spec.
3. Ensure the plan follows `skills/plan/PLAN.md` (living sections, progress, discoveries, decisions, outcomes).
4. During implementation, keep plan sections current at each stopping point.
5. On completion, set `Status: Completed`, add outcome links, and move file to `completed/`.

Use `skills/plan` for both artifact types.

## Current active plans

- [[docs/exec-plans/active/2026-03-07-session-stats-extension]]
- [[docs/exec-plans/active/2026-03-07-session-stats-phase2-tool-details]]

## Recently completed

- [[docs/exec-plans/completed/2026-03-07-zod-hybrid-validation-integration]]
- [[docs/exec-plans/completed/2026-03-06-harness-alignment-plan]]
- [[docs/exec-plans/completed/2026-03-06-pre-commit-quality-gates-lefthook]]
