# Execution Plans

Keep execution plans here only while they are active working context for genuinely complex, multi-session, or architecture-shaping work.

GitHub issues are the canonical backlog. An execution plan is not a backlog item or debt register; it is a living implementation document for work that needs restartable execution context.

## Structure

- `active/` — in-progress plans
- `TEMPLATE.md` — baseline plan structure

Execution-plan authoring standard: `skills/engineering/plan/PLAN.md`

## Spec vs execution plan

- `docs/specs/` = design contract (**what / why / constraints**)
- `docs/exec-plans/` = execution state (**how / when / progress / discoveries**)

Create both only when the work benefits from both.

## When to use an execution plan

Use one when:
- the work is expected to span multiple sessions
- implementation sequencing matters
- discoveries and decision changes need a durable log
- a new agent should be able to restart from the file alone

Do not use one for:
- routine tasks
- backlog tracking
- generic todo lists better kept in GitHub issues

## Current active plans

- [[docs/exec-plans/active/2026-03-12-tracks-extension-workstream-lifecycle-v2]] — milestone 2: workstream lifecycle semantics, richer deterministic summaries, and runtime-state formatter hygiene
- [[docs/exec-plans/active/2026-04-30-context-adr-methodology-adoption]] — roadmap for adopting Context/ADR-oriented support skills across repos

## Archiving

When an execution plan stops being active working context, archive it under `.graveyard/docs/exec-plans/`.
