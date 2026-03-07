---
name: plan
description: "Create an implementation spec and/or execution plan for a task. Self-discovers context before asking questions, then writes to docs/specs/ and/or docs/exec-plans/active/."
---

# Plan

Generate an agent-consumable implementation artifact for a todo/task/issue.
This skill supports **two outputs**:

1. **Implementation spec** (`docs/specs/`) — design contract (what/why/how)
2. **Execution plan** (`docs/exec-plans/active/`) — rollout sequence + status + decision/progress log

For medium/large work, create **both** and cross-link them unless the user explicitly waives one artifact.

## Philosophy

This skill is inspired by:
- Symphony-style spec anatomy (spec as a precise system prompt for implementation)
- OpenAI Codex execution-plan guidance (make execution state explicit and append updates while work happens)

Core principle: **self-discovery first**. Exhaust codebase/docs/todos context before asking the user for missing business decisions.

## Artifact Selection

Choose output type from task intent:

| Task signal | Output |
|---|---|
| "Design this feature", "define behavior/contracts" | Spec |
| "Track implementation", "sequence work", "log progress" | Execution plan |
| Non-trivial feature/initiative with both design and rollout risk | Spec + execution plan |

### Default rule

For medium/large tasks, produce **both** by default:
1. spec first
2. execution plan linked to spec

Only skip one artifact if the user explicitly waives it.

### Execution-plan standard

When generating or updating an execution plan, follow `PLAN.md` (shipped with this skill) as the canonical standard.
- If both spec + plan are required, generate the spec and then generate a plan that conforms to `PLAN.md`.
- Keep the plan as a living document with decision and progress updates during implementation.

## Process

### Phase 1: Understand the task

1. Read user prompt/todo/issue.
2. If todo ID is provided, fetch full todo details.
3. Identify:
   - current state
   - desired end state
   - constraints/deadlines (if any)

### Phase 2: Self-discovery (before asking user questions)

Research code/docs to resolve as much as possible autonomously.

```bash
# Orient in repository
ls -la
find docs -maxdepth 3 -type f | sort

# Read project guidance
read AGENTS.md
read docs/ARCHITECTURE.md
read docs/QUALITY.md
read docs/CONTRIBUTING-DOCS.md
read ./PLAN.md

# Read existing artifacts for style/precedent
find docs/specs -maxdepth 1 -type f | sort
find docs/exec-plans -maxdepth 3 -type f | sort

# Find relevant implementation/test surfaces
rg -n "keyword|symbol|module" extensions skills scripts docs
```

Build a working model of:
- architecture boundaries in affected area
- existing implementation/test conventions
- integration points and constraints
- known quality gaps or prior decisions

### Phase 3: Gap analysis

Identify only genuine unknowns (usually business rules or scope choices).

When asking questions:
1. state what you already discovered
2. ask only unresolved decisions
3. provide your recommended default so user can confirm/correct quickly

### Phase 4: Write artifact(s)

Produce spec, plan, or both (based on Artifact Selection). Keep scope proportional to task complexity.

---

## Spec format (`docs/specs/<date>-<slug>.md`)

```markdown
# <Title>

Status: Draft
Todo: <todo-id or link, if applicable>
Date: <YYYY-MM-DD>
Execution plan: <optional [[docs/exec-plans/active/...]]>

## 1. Problem statement

## 2. Goals and non-goals

### 2.1 Goals
- testable outcomes

### 2.2 Non-goals
- explicit scope exclusions

## 3. System context
- affected modules/integration points
- required conventions/patterns

## 4. Domain model (if needed)
- entities/types/contracts/validation

## 5. Detailed design
- behavior by area
- inputs/outputs/state transitions/defaults

## 6. Error handling and failure modes
- typed error categories + recovery behavior

## 7. Security and safety considerations (if applicable)

## 8. Testing strategy

### 8.1 Unit tests

### 8.2 Integration tests (if applicable)

## 9. Implementation checklist
- [ ] flat actionable sequence

## 10. Open questions (if any)
```

---

## Execution plan format (`docs/exec-plans/active/<date>-<slug>.md`)

Execution plans are **living documents**. They should be updated during implementation.
Use `PLAN.md` (in this skill directory) as the source-of-truth contract; the outline below is a quick-start scaffold.

```markdown
# <Title>

Status: Active
Owner: <team/person/agent>
Created: <YYYY-MM-DD>
Spec: <optional [[docs/specs/...]]>

This ExecPlan is a living document and must be maintained in accordance with `PLAN.md`.

## Purpose / Big picture
- user-visible outcome this plan will deliver

## Progress
- [ ] (<YYYY-MM-DD HH:mm TZ>) Step 1
- [ ] (<YYYY-MM-DD HH:mm TZ>) Step 2

## Surprises & discoveries
- Observation: ...
  Evidence: ...

## Decision log
- Decision: ...
  Rationale: ...
  Date/Author: ...

## Outcomes & retrospective
- completed outcomes
- remaining gaps / follow-ups

## Context and orientation
- relevant files/modules and definitions

## Plan of work
- narrative sequence of implementation steps

## Concrete steps
- exact commands + expected observable outputs

## Validation and acceptance
- tests/checks and user-visible verification

## Idempotence and recovery
- retry/rollback guidance for risky steps

## Artifacts and notes
- concise transcripts/snippets proving behavior

## Interfaces and dependencies
- required types/modules/APIs and why
```

### Completion protocol

When work is done:
1. set `Status: Completed`
2. add final outcome notes/links (PR/commit/spec/tests)
3. move file from `active/` to `completed/`
4. update `docs/exec-plans/README.md` active/completed indexes if needed

---

## Quality rules

1. **Progressive disclosure**: WHY → WHAT → HOW
2. **Explicit boundaries**: in-scope vs out-of-scope must be clear
3. **Typed failures**: avoid vague "throws error"
4. **Testability**: goals must map to tests/checklist
5. **Operational traceability** (plans): keep decision/progress logs current
6. **Cross-linking**: spec ↔ execution plan when both exist
7. **Scale to complexity**: small fix = lighter artifact; large initiative = deeper artifact

## Output rules

- **Medium/large tasks**: create **both** spec + plan unless user explicitly waives one artifact
- **Spec only**: write `docs/specs/<date>-<slug>.md`
- **Plan only**: write `docs/exec-plans/active/<date>-<slug>.md` and align structure with `PLAN.md`
- **Both**: create both and cross-link each other
- Tell the user exact file path(s) created/updated
- If updating an existing execution plan, append a progress entry and keep decision/discovery sections current (do not rewrite history)
