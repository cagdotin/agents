---
name: create-spec
description: "Create a detailed implementation spec for a todo/task/issue. Self-discovers context from the codebase and research before asking questions. Produces a spec markdown file under specs/."
---

# Create Spec

Generate a comprehensive, agent-consumable implementation specification for a given todo, task, or issue. The output is a markdown file saved under `specs/` in the project root.

## Philosophy

This skill is modeled after the [Symphony SPEC.md](https://github.com/openai/symphony) anatomy — a spec structure designed to be consumed by AI coding agents. The key insight: a good spec is a **precise system prompt** that establishes context, vocabulary, contracts, behavior, guardrails, and acceptance criteria.

**Self-discovery first**: Exhaust what you can learn from the codebase, todos, existing specs, documentation, and project context BEFORE asking the user to fill gaps. The user should only answer questions that cannot be resolved by reading code.

## Process

### Phase 1: Understand the Task

1. Read the todo/task/issue provided by the user. If a todo ID is given, use `todo get` to fetch it.
2. Identify the core problem: what needs to change, what exists today, what the desired end state is.

### Phase 2: Self-Discovery (Do This Thoroughly Before Asking Questions)

Research the codebase to answer as many spec questions as possible autonomously:

```bash
# Understand project structure
ls -la src/
find . -name "*.md" -not -path "*/node_modules/*" | head -30

# Read project guidance
# Look for CLAUDE.md, README.md, CONTRIBUTING.md, architecture docs
cat CLAUDE.md 2>/dev/null
cat README.md 2>/dev/null

# Read existing specs for format/pattern reference
ls specs/ 2>/dev/null && cat specs/*.md 2>/dev/null

# Understand the domain area affected by the task
# Use grep/rg to find relevant code, tests, types, interfaces
rg -l "relevant_keyword" src/
rg "interface|type|class" src/relevant-area/

# Read the specific files that will be modified
cat src/path/to/affected/module.ts

# Read existing tests to understand expected behavior
find src/__tests__ -name "*.test.*" | head -20
cat src/__tests__/relevant.test.ts

# Check dependencies and tech stack
cat package.json | jq '.dependencies, .devDependencies'

# Look at git history for context on the area
git log --oneline -20 -- src/relevant-area/
```

Build a mental model of:
- **Current architecture** in the affected area
- **Existing patterns** the codebase uses (naming, error handling, testing, DI)
- **Types and interfaces** that exist and constrain the design
- **Integration points** where the new code touches existing code
- **Test patterns** used in the project

### Phase 3: Gap Analysis

After self-discovery, identify what you still DON'T know. Common gaps:
- Business rules that aren't in the code (e.g., "what should happen when X?")
- Prioritization or scope decisions (e.g., "should we handle edge case Y in this iteration?")
- External system behaviors not documented in the codebase
- UX/product decisions that code can't tell you

**Only ask the user about genuine gaps.** Frame questions precisely, explain what you already found, and offer your best-guess default for each question so the user can just confirm or correct.

### Phase 4: Write the Spec

Generate the spec following the anatomy below. Save it to `specs/<kebab-case-name>.md`.

Not every section applies to every task. **Scale the spec to the task complexity:**
- Small bug fix or config change → Sections 1-4, 8, 9 may suffice
- New feature or module → Most sections apply
- Architectural change → All sections, heavy on §3, §6, §7

## Spec Anatomy

The spec follows this structure. Adapt section depth to task complexity.

```markdown
# <Title>

Status: Draft
Todo: <todo-id or link, if applicable>
Date: <creation date>

## 1. Problem Statement

WHY does this need to exist? What problem does it solve?
What is the current state? What is the desired state?

Include an "Important boundary" note if scope needs fencing:
> **Important boundary:** This spec covers X. It does NOT cover Y.

## 2. Goals and Non-Goals

### 2.1 Goals
- Concrete, verifiable behaviors (each should be testable)

### 2.2 Non-Goals
- Temptations explicitly killed to prevent scope creep

## 3. System Context

How does this change fit into the existing architecture?
- Which modules/files are affected?
- What are the integration points?
- What existing patterns must be followed?

Include a simple diagram or file tree if it helps orientation.

## 4. Domain Model

Define entities, types, interfaces that this change introduces or modifies.
Include field names, types, defaults, and validation rules.

This section establishes the **shared vocabulary** for the rest of the spec.
Skip if no new types are introduced.

## 5. Detailed Design

The behavioral heart of the spec. What does the system DO?

### 5.1 <Feature/Behavior Area>
- Input/output contract
- Algorithm or logic (pseudocode for complex flows)
- State transitions if applicable
- Configuration and defaults

### 5.2 <Next Feature/Behavior Area>
...

## 6. Error Handling and Failure Modes

For each failure class:
- What can go wrong?
- How is it detected?
- What is the recovery behavior?
- What error type/message is produced?

Use typed error categories, not vague "throw an error" language.

## 7. Security and Safety Considerations

- Input validation requirements
- Trust boundaries
- Sensitive data handling
- Authorization checks

Skip if not applicable to the task.

## 8. Testing Strategy

What tests need to be written?

### 8.1 Unit Tests
- Key behaviors to test
- Edge cases
- Error paths

### 8.2 Integration Tests (if applicable)
- What needs real integration testing?
- What can be mocked?

## 9. Implementation Checklist

A flat, checkable list of everything that must be done.
Ordered by suggested implementation sequence.

- [ ] Step 1: ...
- [ ] Step 2: ...
- [ ] Final: Update relevant documentation

## 10. Open Questions (if any)

Unresolved decisions that need input before or during implementation.
Each should state what you know, what you don't, and your recommended default.
```

## Principles for Good Specs

1. **Progressive disclosure**: WHY → WHAT → HOW EXACTLY. A reader can stop at any depth.
2. **Explicit boundaries**: Every section says what it IS and ISN'T responsible for.
3. **Domain model as vocabulary**: Define types/entities before algorithms so later sections can reference them unambiguously.
4. **Typed errors**: Name every error category. "Returns `invalid_session_token` error" not "throws an error."
5. **Failure-first**: Every design section must address what happens when things go wrong.
6. **Deliberate redundancy**: If a consumer needs info from 3 different sections, duplicate it into a cheat sheet. Optimize for the reader, not for DRY.
7. **Testable acceptance criteria**: Every goal should map to a test. The implementation checklist is the definition of done.
8. **Scale to complexity**: A 5-line bug fix doesn't need 18 sections. Use judgment.

## Output

- Save the spec to `specs/<kebab-case-name>.md`
- Create the `specs/` directory if it doesn't exist
- Use the task/todo title to derive the filename
- Tell the user the file path when done
