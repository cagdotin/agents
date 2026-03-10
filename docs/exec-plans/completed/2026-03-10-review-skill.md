# Review Skill — Implementation Plan

Status: Completed
Owner: agent
Created: 2026-03-10
Spec: [[docs/specs/2026-03-10-review-skill.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/plan/PLAN.md`.

## Purpose / Big picture

Create a standalone `review` skill that provides a universal, lens-based code review methodology. After this work, an agent (or user) can invoke `/skill:review` on any set of code changes — local diff, staged files, branch comparison — and get a structured review report. The review logic is decoupled from GitHub PRs and reusable by any caller.

**What someone can do after this change that they could not do before:**
- Say "review my changes" and get a structured, multi-dimensional analysis
- Request a focused review on a single dimension (e.g., "review for security only")
- Get a consistent core findings format regardless of how the review was triggered

## Progress

- [x] (2026-03-10 17:08 CET) Milestone 1: Created `skills/review/SKILL.md` as a repo-agnostic router with scope selection, lens index, and review-boundary guidance.
- [x] (2026-03-10 17:09 CET) Milestone 2: Created `skills/review/references/report-format.md` for the reusable core review report shape.
- [x] (2026-03-10 17:11 CET) Milestone 3: Added six lens files under `skills/review/references/lenses/` covering architecture, correctness, security, quality, testing, and dependencies.
- [x] (2026-03-10 17:12 CET) Milestone 4: Added `skills/review/README.md` describing purpose, scope, and relationship to PR-review wrappers.
- [x] (2026-03-10 17:14 CET) Milestone 5: Validated the implementation in this repository with local docs checks and the full `bun run check` suite.

## Surprises & discoveries

- Observation: No extra skill-specific support files were required by this repository's docs validator; `SKILL.md` frontmatter plus the new reference files were sufficient.
  Evidence: `bun run check:docs` passed immediately after adding `skills/review/`.

## Decision log

- Decision: Review is a standalone skill, not a sub-section of the github skill.
  Rationale: Review is the core primitive. PR review, self-review, and on-demand review are all consumers. Keeps the methodology reusable and decoupled.
  Date/Author: 2026-03-10 / user + agent brainstorm

- Decision: Lenses are separate reference files, not one big checklist.
  Rationale: Progressive disclosure — agent loads only the lenses it needs. Also enables future sub-agent-per-lens pattern if lenses grow.
  Date/Author: 2026-03-10 / user

- Decision: The router selects relevant lenses by default instead of mechanically applying every lens.
  Rationale: Broad review coverage is still the default, but obviously irrelevant lenses should not add noise.
  Date/Author: 2026-03-10 / user + agent

- Decision: Docs, observability, and accessibility guidance live under `quality.md`, not `dependencies.md`.
  Rationale: Dependency findings should stay about dependencies. Change hygiene and maintainability concerns fit the quality lens better.
  Date/Author: 2026-03-10 / user + agent

- Decision: "Alternative approaches" analysis is off by default.
  Rationale: Only relevant when findings reveal concrete structural problems or user explicitly asks. Avoids noise.
  Date/Author: 2026-03-10 / user

- Decision: Mechanical validation is outside the review skill's scope.
  Rationale: The skill should stay portable and focused on judgment-based review. Repo-specific lint/type/test/docs commands belong to local hooks, CI, or caller workflows, not the skill instructions.
  Date/Author: 2026-03-10 / user + agent

- Decision: Self-review (Ralph Wiggum Loop) is deferred.
  Rationale: A review sub-agent that gives feedback is the better long-term pattern. Manual review invocation works for now.
  Date/Author: 2026-03-10 / user

- Decision: `skills/pr-review/` remains canonical for PR review until follow-up migrations land.
  Rationale: This plan creates the reusable review methodology, but does not yet update PR review entrypoints or wrappers.
  Date/Author: 2026-03-10 / user

- Decision: Do not modify pr-review or github skills in this plan.
  Rationale: Separate plan for the github skill merger. This plan only creates the review skill.
  Date/Author: 2026-03-10 / user + agent

## Outcomes & retrospective

Implemented the new `skills/review/` skill as planned: a short router, a shared report format, six focused review lenses, and a README. The resulting skill is repository-agnostic and explicitly scoped to judgment-based review rather than mechanical validation.

What worked well:
- Extracting the old PR-review checklist into lens files made the review concerns easier to scan and reuse.
- Keeping docs, observability, and accessibility under the quality lens produced a cleaner taxonomy than folding them into dependencies.
- Separating portable skill behavior from this repository's local validation kept the skill design cleaner.

What remains:
- Follow-up migration work can later teach PR-review-specific workflows to call into `/skill:review`.
- `skills/pr-review/` remains the canonical PR review entrypoint until that separate migration lands.

## Context and orientation

### Repository structure (relevant)

```text
skills/
├── commit/SKILL.md        # Will be absorbed into github skill (separate plan)
├── github/SKILL.md        # Will become the merged github skill (separate plan)
├── pr-review/SKILL.md     # Current canonical PR review entrypoint; checklist source material
├── plan/SKILL.md          # Reference for plan format
└── (review/)              # ← this plan creates this
```

### Key files to reference during implementation

- `skills/pr-review/SKILL.md` — contains the review checklist to extract and refactor into lenses
- `docs/specs/2026-03-10-review-skill.md` — source of truth for scope, report format, and lens behavior
- `skills/plan/PLAN.md` — exec plan maintenance rules

### Pi skill conventions

- `SKILL.md` requires frontmatter: `name` (must match directory), `description` (triggers auto-loading)
- Reference files under `references/` loaded via relative paths
- Skills are static markdown — no runtime code
- The skill content itself should stay repository-agnostic: no hardcoded references to this repo's specific docs, expertise domains, or conventions files

## Plan of work

### Milestone 1: SKILL.md router

Create the core skill file. It should:
- Have a description broad enough to trigger on "review", "review my changes", "code review", "check this code"
- Act as a short router (~40-60 lines of content)
- Include a lens index table with all available lenses
- Define the scope determination flow (what diff to review)
- Include a generic "gather context" instruction (read surrounding code, relevant docs, and conventions for the current repository)
- State that the agent should load the lenses relevant to the changes by default, unless the user narrows the review
- Instruct the agent to ask the user when both staged and unstaged changes exist and the request is ambiguous
- Explicitly keep the review focused on non-mechanical concerns rather than repo-specific lint/type/test/package-manager commands
- State the alternative-approaches clause (off by default)
- Point to `references/report-format.md` for output

### Milestone 2: Report format

Create `references/report-format.md` defining:
- Summary section
- Findings grouped by lens, each with severity/location/description/impact/suggestion
- Optional verdict section (for when called from PR review context)
- Clarification that callers may wrap the core findings with workflow-specific sections (e.g. PR claims-vs-reality)

### Milestone 3: Lens files

Extract and refactor the checklist from `pr-review/SKILL.md` into individual lens files. Each lens gets `references/lenses/<name>.md` with a consistent structure:
- What to look for
- Questions to ask
- Common patterns to flag
- Context to gather before judging changes in that lens

Six initial lenses:
1. `architecture.md` — boundaries, layers, coupling, separation of concerns, pattern drift
2. `correctness.md` — logic errors, edge cases, error handling, null/undefined, race conditions, type safety
3. `security.md` — injection, auth, secrets, input validation, deserialization
4. `quality.md` — duplication, naming, complexity, dead code, readability, docs, observability, accessibility for UI changes
5. `testing.md` — missing tests, coverage gaps, test quality, edge cases
6. `dependencies.md` — new deps justified, version bumps, license, unused deps

### Milestone 4: README

Create `skills/review/README.md` with: purpose, usage, available lenses, how it relates to PR review wrappers.

### Milestone 5: Validate

Validate the implementation in this repository. This step is about landing the new skill here; it is **not** part of the review skill's portable instructions.

Use this repository's local docs/skill validation to verify:
- SKILL.md frontmatter is valid
- Relative references resolve
- README/docs expectations pass

Optionally run broader repository checks if the baseline is already clean.

## Concrete steps

### Step 1: Create directory structure

```bash
mkdir -p skills/review/references/lenses
```

### Step 2: Create SKILL.md

Write `skills/review/SKILL.md` — see spec § 5.1 for content requirements.

### Step 3: Create report-format.md

Write `skills/review/references/report-format.md` — see spec § 5.3.

### Step 4: Create lens files

Write each of the six lens files under `skills/review/references/lenses/` — see spec § 5.2 for internal structure and § 4 for lens catalog.

Source material: extract and refactor the review checklist table from `skills/pr-review/SKILL.md` (the table under "Review Checklist" with areas: Correctness, Error handling, Security, Performance, Side effects, Breaking changes, Race conditions, Type safety, Tests, Docs, Dependencies, Code quality, Observability, Accessibility).

Mapping from pr-review checklist → lenses:
- Correctness + Error handling + Race conditions + Type safety + Side effects + Breaking changes → `correctness.md`
- Security → `security.md`
- Code quality + Docs + Observability + Accessibility → `quality.md`
- Tests → `testing.md`
- Dependencies → `dependencies.md`
- Performance → split across `correctness.md` (logic) and `architecture.md` (structural)
- Architecture (new) → `architecture.md` — boundary violations, pattern drift, coupling. Not in current pr-review; this is new content.

### Step 5: Create README

Write `skills/review/README.md` with: purpose, usage, available lenses, how it relates to PR review wrappers and future github-skill integration.

### Step 6: Validate

Run this repository's local docs/skill validation command(s) and verify the new skill passes them. If the repository baseline is already green, optionally run broader repository checks as a follow-up.

Expected: local docs validation passes for the new skill. These commands are implementation-time checks for this repository, not part of the review skill's runtime behavior.

## Validation and acceptance

1. This repository's local docs/skill validation passes with no new errors.
2. Optional: broader repository checks also pass if the existing baseline is clean.
3. All files exist at expected paths:
   - `skills/review/SKILL.md`
   - `skills/review/README.md`
   - `skills/review/references/report-format.md`
   - `skills/review/references/lenses/architecture.md`
   - `skills/review/references/lenses/correctness.md`
   - `skills/review/references/lenses/security.md`
   - `skills/review/references/lenses/quality.md`
   - `skills/review/references/lenses/testing.md`
   - `skills/review/references/lenses/dependencies.md`
4. SKILL.md frontmatter has valid `name: review` and `description`.
5. All relative paths referenced in SKILL.md resolve to actual files.
6. Smoke test: in a Pi session, `/skill:review` loads correctly and the agent follows the methodology.
7. The skill text is repository-agnostic and does not hardcode this repo's specific docs or expertise files.

## Idempotence and recovery

This plan only creates new files — no existing files are modified or deleted. Safe to re-run any step. If the skill needs to be recreated, delete `skills/review/` and start from step 1.

## Artifacts and notes

Validation evidence gathered during implementation:

- `bun run check:docs`
  - Output: `✅ Documentation validation passed.`
- `bun run check`
  - `biome check .` passed
  - `bun run scripts/validate-docs.ts` passed
  - `vitest run` passed with `15 passed` test files and `420 passed` tests

Created artifacts:
- `skills/review/SKILL.md`
- `skills/review/README.md`
- `skills/review/references/report-format.md`
- `skills/review/references/lenses/architecture.md`
- `skills/review/references/lenses/correctness.md`
- `skills/review/references/lenses/security.md`
- `skills/review/references/lenses/quality.md`
- `skills/review/references/lenses/testing.md`
- `skills/review/references/lenses/dependencies.md`

## Interfaces and dependencies

No runtime dependencies. This is a pure markdown skill.

The review skill is designed to be **consumed by** the github skill's `pr-review.md` reference (created in the separate github skill plan). That plan will add a cross-reference like "for thorough analysis, also load `/skill:review`". This plan does not create that cross-reference, and `skills/pr-review/` remains the canonical PR review entrypoint until that migration lands.
