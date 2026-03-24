# Execution Plans (ExecPlans)

This document defines the requirements for an execution plan ("ExecPlan"): a living implementation document that a coding agent can follow to deliver a working feature or system change.

Treat the reader as a complete beginner to the repository they are working in. Assume they only have the current working tree and this one plan document.

## How to use this file

When authoring an ExecPlan, follow `PLAN.md` in this skill directory exactly.
If it is not in context, read it fully before writing or revising a plan.

When implementing from an ExecPlan:
- proceed milestone by milestone without asking for "next steps" unless blocked by a true ambiguity,
- keep all living sections current at every stopping point,
- record what changed and why.

When discussing or revising an ExecPlan:
- log decisions in the `Decision Log`,
- keep the document restartable from zero context,
- preserve a clear chain of reasoning.

For uncertain or high-risk work, include prototyping milestones to validate feasibility early.

## Non-negotiable requirements

- Every ExecPlan must be self-contained.
- Every ExecPlan must be a living document and updated continuously.
- Every ExecPlan must guide a novice to complete the work end-to-end.
- Every ExecPlan must target demonstrably working behavior, not only code edits.
- Every term of art must be defined in plain language when introduced.

Start with purpose and user-visible intent: what someone can do after the change that they could not do before, and how to verify it.

Do not rely on prior conversation context. Repeat assumptions you rely on.
If external knowledge is required, summarize it in the plan in your own words.

When a spec exists for this work, reference it by path and inherit its decisions — do not repeat the WHY. The spec owns intent, constraints, and decisions; the plan owns sequence, steps, and verification. Summarize just enough spec context for orientation, then focus on HOW and WHEN.

## Formatting

For standalone markdown files where the file itself is the plan, write plain markdown directly (no outer fenced block).

Write prose-first narrative. Avoid checklist-only specs except where explicitly required.
Checklists are mandatory in `Progress`, optional elsewhere.

## Writing guidelines

### 1) Self-contained and novice-guiding

Define unfamiliar terms immediately and tie them to concrete files/modules/commands in the target repository.
Never rely on references like "as discussed earlier".

### 2) Outcome-focused

Anchor acceptance criteria in observable behavior.
Prefer "run X, observe Y" over internal implementation claims.

### 3) Repository-specific and concrete

Name repository-relative paths, functions, modules, and interfaces precisely.
When listing commands, include working directory assumptions.

### 4) Safe and idempotent

Describe retry/rollback paths for risky steps.
Prefer additive, testable increments.

### 5) Validation is required

Include tests and direct behavior checks.
State expected outputs or outcomes so success/failure is unambiguous.

### 6) Evidence matters

Include concise command output snippets, logs, or excerpts that prove progress or decisions.

## Milestones

Milestones should read like a story: goal → work → result → proof.
Each milestone must be independently verifiable and incrementally advance the overall goal.

## Living sections (required)

Every ExecPlan must include and maintain these sections:
- `Progress`
- `Surprises & Discoveries`
- `Decision Log`
- `Outcomes & Retrospective`

If direction changes mid-implementation, record why in `Decision Log` and update `Progress` accordingly.

## Prototyping and parallel paths

You may include explicit prototyping milestones when they reduce risk.
Parallel implementations during migrations are acceptable when they keep validation possible and reduce breakage risk.
State how to validate both paths and how one path will be retired safely.

## Skeleton of a good ExecPlan

# <Short action-oriented title>

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

If this repository contains a planning standard file (for example `PLAN.md`), explicitly reference it and state this plan conforms to it.

## Purpose / Big picture

Describe user-visible outcomes and how to verify them.

## Progress

Use timestamped checkboxes. Always reflect true current state.

- [x] (2026-03-07 14:00Z) Example completed step.
- [ ] (2026-03-07 14:10Z) Example incomplete step.
- [ ] (2026-03-07 14:15Z) Example split step (done X, remaining Y).

## Surprises & Discoveries

Record unexpected behaviors, constraints, bugs, or performance findings.

- Observation: ...
  Evidence: ...

## Decision Log

Record key decisions and rationale.

- Decision: ...
  Rationale: ...
  Date/Author: ...

## Outcomes & Retrospective

Summarize what was achieved, what remains, and lessons learned.

## Context and orientation

Describe current relevant state for a novice, with explicit file/module references.

## Plan of work

Narrative sequence of edits and additions.

## Concrete steps

Exact commands, where to run them, and expected outputs.

## Validation and acceptance

How to run checks/tests and what behavior must be observed.

## Idempotence and recovery

Safe re-run, rollback, and partial-failure handling guidance.

## Artifacts and notes

Short transcripts/snippets proving progress.

## Interfaces and dependencies

List required modules/types/APIs that must exist at completion and why.

---

Quality bar: a stateless agent or novice human should be able to read the plan top-to-bottom and produce a working, observable result.
