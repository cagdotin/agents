# Execution Plans

Execution plans live here only for genuinely complex, multi-session, or architecture-shaping work.

GitHub issues are the canonical backlog. An execution plan is not a backlog item or debt register; it is a living implementation document for work that needs restartable execution context.

## Structure

- `active/` — in-progress plans
- `completed/` — finished plans with outcome references
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

## Recently completed

- [[docs/exec-plans/completed/2026-04-30-documentation-memory-model-cleanup]] — coordinated cleanup that simplified the repository documentation model around memory types and replaced audit drift checks with structural validation
- [[docs/exec-plans/completed/2026-04-30-phase-1-context-adr-foundation-skills]] — add `grill-with-docs`, `setup-repo-methodology`, and `zoom-out`, plus shared Context/ADR references for engineering skills
- [[docs/exec-plans/completed/2026-04-30-skill-taxonomy-refinement-and-reference-normalization]] — refine the category taxonomy to `engineering` / `productivity` / `tools` and normalize repository references to current skill paths
- [[docs/exec-plans/completed/2026-04-30-legacy-skill-categorization]] — move legacy flat skills into category directories as a precursor to the later `tools/` taxonomy refinement
- [[docs/exec-plans/completed/2026-04-30-skill-imports-and-classified-catalog]] — import requested Matt Pocock skills and add initial `engineering/` + `productivity/` grouping under `skills/`
- [[docs/exec-plans/completed/2026-04-14-pi-lifecycle-alignment-and-doc-pruning]] — align live extensions with modern Pi lifecycle hooks and trim redundant package-level guidance
- [[docs/exec-plans/completed/2026-04-14-conditional-feature-stateful-helper-and-doc-sync]] — align the conditional feature helper docs/tests with the state-driven helper lifecycle
- [[docs/exec-plans/completed/2026-03-11-tracks-extension-minimal-v1]] — minimal task-scoped track workspaces with local AGENTS.md, snapshots, and closeout flow
- [[docs/exec-plans/completed/2026-03-10-docs-audit-script]] — historical audit automation work, now superseded by structural validation
- [[docs/exec-plans/completed/2026-03-10-review-skill]] — standalone review skill with lens-based methodology
- [[docs/exec-plans/completed/2026-03-10-github-skill-merge]] — merge commit + pr-review + github into one skill
- [[docs/exec-plans/completed/2026-03-06-pre-commit-quality-gates-lefthook]]
