# Phase 1 context/ADR foundation skills

Status: Draft
Date: 2026-04-30
Execution plan: [[docs/exec-plans/completed/2026-04-30-phase-1-context-adr-foundation-skills.md]]

## 1. Problem statement

The package now has the categorized skill catalog and the design decision to adopt a Matt-Pocock-style methodology around `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/`. The next step is to implement the three P0 foundation skills that make that methodology usable across downstream repositories:

- `grill-with-docs`
- `setup-repo-methodology`
- `zoom-out`

The implementation should fit this package's conventions rather than copying upstream literally.

## 2. Goals and non-goals

### 2.1 Goals

- Add `skills/engineering/grill-with-docs/`
- Add `skills/engineering/setup-repo-methodology/`
- Add `skills/engineering/zoom-out/`
- Provide shared engineering references for `CONTEXT.md` and ADR formatting so multiple skills can reuse them.
- Adapt the setup/bootstrap skill to this package's AGENTS-first but repo-portable methodology.
- Update category docs and planning records.

### 2.2 Non-goals

- Implement Phase 2 skills (`diagnose`, `tdd`) or Phase 3 issue workflow skills.
- Introduce runtime extensions for issue-tracker abstraction.
- Force the setup skill to eagerly create `CONTEXT.md` or ADR files in downstream repos before they are needed.

## 3. System context

### Affected areas

- `skills/engineering/` — new skills and shared references
- `docs/specs/` and `docs/exec-plans/` — implementation record
- `skills/engineering/README.md` — category index
- `skills/engineering/improve-codebase-architecture/` — update to shared reference paths if references are centralized

### Relevant conventions

- Skills are static markdown and support files.
- Skill names must match directory basenames.
- Shared package skills should remain repo-agnostic where possible.
- Current planning standards live under `skills/engineering/plan/`.

## 4. Detailed design

### 4.1 `grill-with-docs`

Import the upstream workflow closely, but point it at shared engineering references instead of private copies inside the skill directory.

Behavior:
- grill the user one question at a time
- read and challenge `CONTEXT.md` / `CONTEXT-MAP.md`
- suggest or create ADRs only when durable trade-off criteria are met
- update `CONTEXT.md` inline as terms are resolved

### 4.2 `setup-repo-methodology`

Adapt `setup-matt-pocock-skills` into a package-neutral bootstrap skill.

Adaptations:
- rename to `setup-repo-methodology`
- keep support for GitHub, GitLab, local markdown, and freeform issue trackers
- edit `AGENTS.md` when it exists; otherwise create `AGENTS.md`
- keep writing repo-local consumer docs under `docs/agents/`
- describe the methodology in package-neutral language rather than upstream-branded language

### 4.3 `zoom-out`

Import nearly verbatim. It is intentionally small and should remain lightweight.

### 4.4 Shared engineering references

Create:
- `skills/engineering/references/context-format.md`
- `skills/engineering/references/adr-format.md`

Then update `improve-codebase-architecture` and `grill-with-docs` to use those shared files.

## 5. Error handling and failure modes

- Do not break existing `improve-codebase-architecture` links when centralizing shared references.
- The setup skill must not assume a single issue tracker or a single agent harness.
- The setup skill should create files lazily and avoid surprising repo-wide scaffolding.

## 6. Testing strategy

### 6.1 Validation

- Run `bun run check:docs`
- Run `bun run check:boundaries`
- Run `bun run test`

### 6.2 Acceptance checks

- the three new skills exist with valid frontmatter
- `skills/engineering/README.md` indexes them
- `improve-codebase-architecture` references resolve after shared-reference extraction
- validation passes except for any already-known unrelated blockers

## 7. Implementation checklist

- [ ] Create spec and execution plan
- [ ] Add shared engineering `context-format` and `adr-format` references
- [ ] Add `grill-with-docs`
- [ ] Add `setup-repo-methodology` and support files
- [ ] Add `zoom-out`
- [ ] Update engineering category docs and any affected skill references
- [ ] Run validation and record blockers

## 8. Open questions

- None currently.
