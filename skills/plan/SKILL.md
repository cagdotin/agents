---
name: plan
description: "Create an implementation spec and/or execution plan for a task. Self-discovers context before asking questions, then writes to docs/specs/ and/or docs/exec-plans/active/."
---

# Plan

Generate an agent-consumable implementation artifact for a todo/task/issue.
This skill supports **two outputs**:

1. **Implementation spec** (`docs/specs/`) — decisions, constraints, and intent (WHAT/WHY)
2. **Execution plan** (`docs/exec-plans/active/`) — implementation sequence, concrete steps, verification (HOW/WHEN)

For medium/large work, create **both** and cross-link them unless the user explicitly waives one artifact.

## Philosophy

A spec is **externalized thinking** — a record of the decisions, constraints, and intent discovered during collaborative research. It persists context across sessions so a fresh implementing agent starts with clear WHAT and WHY, not a cold start.

A spec is NOT a code-generation blueprint. When a spec tries to be precise enough to generate working code cold, it necessarily converges on code — gaining all of code's complexity while losing the benefits of prose (reasoning, trade-offs, intent). The implementing agent should be making HOW decisions, not guessing at intent. If it has to guess at intent, the spec failed. If it has to follow pseudocode line by line, the spec overreached.

**Specs capture decisions. Code captures implementations. Exec plans bridge the two.**

Core principle: **self-discovery first**. Exhaust codebase and docs context before asking the user for missing business decisions.

## Modes of use

This skill operates in two modes depending on context:

### Delegated mode
The task is clear, the codebase is well-established or small. The user says "investigate and plan." The agent runs the full process (Phase 1→4) mostly autonomously — researches, drafts, presents for review.

### Collaborative mode
The territory is unclear — the user doesn't fully understand the code, or the approach isn't decided yet. The spec emerges from back-and-forth conversation:
- The agent researches code, traces connections, reports findings
- The user provides domain context, judgment, and preferences
- Both sides ask questions until shared understanding converges
- The "gut feeling" arrives: enough alignment to crystallize a spec
- Phase 4 captures what was discovered together, not what the agent decided alone

**In collaborative mode, the conversation IS the research phase.** The spec is a conversation artifact — it persists the shared understanding so a fresh implementing session inherits it. The user reviews the spec not for perfection but for: "does this capture the right decisions? Would a new team member understand the task from this?"

Most non-trivial work uses collaborative mode. Delegated mode works best for well-scoped tasks in mature codebases.

## Calibrating spec detail

Spec detail is not fixed by rules — it's calibrated by what the environment already provides. The spec fills the gap between what the codebase/docs/conventions already teach and what the implementing agent needs.

**More detail when:**
- Codebase is young — few examples, patterns not established
- Introducing a new pattern — no existing code to learn from
- Taste matters and isn't yet encoded — include reference code examples showing "do it like this existing module"
- The task crosses unfamiliar boundaries — integrations, external APIs, novel domains

**Less detail when:**
- Codebase is mature — consistent patterns the agent can learn from existing code
- Conventions are documented — AGENTS.md, ARCHITECTURE.md, style guides cover it
- The task follows established patterns — the agent will replicate them naturally

**Code examples in specs are legitimate when they encode taste** — "structure your module like `src/handlers/example.ts`" isn't dictating implementation, it's transferring style that the agent would otherwise guess at. This is different from pseudocode that dictates logic. The test: does this example show HOW WE DO THINGS HERE, or does it dictate HOW TO DO THIS SPECIFIC THING? The first belongs in specs. The second belongs in code.

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

### Phase 3: Gap analysis and collaborative exploration

Identify genuine unknowns. In collaborative mode, this phase is a two-way conversation:

**Agent → User** (business decisions, scope choices):
1. state what you already discovered
2. ask only unresolved decisions
3. provide your recommended default so user can confirm/correct quickly

**User → Agent** (code understanding, technical exploration):
- The user may ask you to trace code paths, explain modules, or investigate how things connect
- Report findings clearly — this builds the shared understanding that the spec will capture
- Surface non-obvious constraints or patterns you discover

Continue until shared understanding converges — both sides agree on what the task is, what the approach should be, and what matters.

### Phase 4: Crystallize into artifact(s)

Produce spec, plan, or both (based on Artifact Selection). Keep scope proportional to task complexity.

In collaborative mode, this step captures what was discovered together — not what the agent decided alone. Frame it as: "here's what we established" not "here's what I recommend."

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

## 4. Conventions and style (calibrate to need)
- reference modules to follow as style examples ("structure like src/handlers/example.ts")
- library/tool choices and why (when not already established)
- coding guidelines specific to this task (when the codebase doesn't already demonstrate them)
- omit this section when the codebase is mature enough that existing patterns speak for themselves

## 5. Domain model (if needed)
- entities, their relationships, and key design constraints
- describe WHY entities exist and what invariants matter
- do NOT dump field-by-field schemas — that belongs in code

## 6. Detailed design
- behavioral intent by area: what each component should achieve
- key design decisions and the constraints that motivated them
- describe WHAT and WHY, not HOW
- if you're writing pseudocode, the detail belongs in the exec plan or code

## 7. Error handling and failure modes
- error philosophy: retry vs fail-fast, user-facing vs internal
- failure categories and recovery strategy
- do NOT write exhaustive if/else chains — describe the approach

## 8. Security and safety considerations (if applicable)

## 9. Testing strategy

### 9.1 Unit tests

### 9.2 Integration tests (if applicable)

## 10. Implementation checklist
- [ ] flat actionable sequence

## 11. Open questions (if any)
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
8. **The decision test**: ask "am I capturing a decision or dictating an implementation?" Specs answer WHAT and WHY; exec plans and code answer HOW
9. **The onboarding test**: could a new team member understand the task and implement it from this spec alone? If not, what's missing — intent, context, or taste? Add that, not more pseudocode

## Spec anti-patterns

Watch for these signs that a spec has overreached into code territory:

- **Schema dumps** — listing every field of a data structure instead of describing entities and relationships
- **Pseudocode in prose** — writing `delay = min(10000 * 2^(attempt-1), max_backoff)` instead of "exponential backoff capped at 5 minutes"
- **Cheat sheet sections** — adding redundant summaries "so the agent can implement quickly" — if the spec needs a cheat sheet, it's trying to be code
- **Reference algorithms for routine logic** — reserve pseudocode for genuinely novel algorithms where the approach itself is the decision; standard patterns (retry, pagination, CRUD) don't need it
- **Growing toward the implementation's size** — if the spec approaches the length of the code it describes, it has become the territory, not the map

**Exception: taste-encoding code examples are not anti-patterns.** A snippet showing "structure like this existing module" or "follow this naming convention" demonstrates style, not implementation. The test: does the example show HOW WE DO THINGS HERE (legitimate) or HOW TO DO THIS SPECIFIC THING (overreach)?

## Output rules

- **Medium/large tasks**: create **both** spec + plan unless user explicitly waives one artifact
- **Spec only**: write `docs/specs/<date>-<slug>.md`
- **Plan only**: write `docs/exec-plans/active/<date>-<slug>.md` and align structure with `PLAN.md`
- **Both**: create both and cross-link each other
- Tell the user exact file path(s) created/updated
- If updating an existing execution plan, append a progress entry and keep decision/discovery sections current (do not rewrite history)
