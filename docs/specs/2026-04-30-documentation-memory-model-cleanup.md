# Documentation memory model cleanup

Status: Draft
Date: 2026-04-30
Issue: #1
Execution plan: [[docs/exec-plans/completed/2026-04-30-documentation-memory-model-cleanup.md]]

## 1. Problem statement

The repository documentation surface has grown overlapping categories and stale routing assumptions. `docs/QUALITY.md`, `docs/CONTRIBUTING-DOCS.md`, `docs/reports/`, and `scripts/audit-docs.ts` no longer fit the desired model. Multiple entry surfaces repeat each other, top-level references mix shared and owned material, and several skills/scripts still assume the retired docs exist.

## 2. Goals and non-goals

### 2.1 Goals

- Reorganize repository docs around the accepted memory model from ADR 0001.
- Keep entry surfaces narrow, non-overlapping, and progressively discoverable.
- Introduce `docs/coding-conventions.md` as the stable home for naming and style rules.
- Keep `docs/specs/` and `docs/exec-plans/` available, but narrow their entry criteria to genuinely complex work.
- Move structural enforcement into `scripts/validate-docs.ts` and remove the separate audit surface.
- Remove obsolete docs and categories once routing/tooling dependencies are updated.

### 2.2 Non-goals

- Eliminate specs or exec plans entirely in this pass.
- Rewrite all historical completed plans/specs to remove old references.
- Redesign extension runtime code beyond documentation ownership moves required by the new model.

## 3. System context

Relevant surfaces:
- `README.md`, `AGENTS.md`, `docs/README.md`, `docs/ARCHITECTURE.md`
- `docs/DESIGN-PRINCIPLES.md`, `docs/TESTING.md`, `docs/agents/`, `docs/references/`
- `docs/specs/README.md`, `docs/exec-plans/README.md`, `docs/exec-plans/TEMPLATE.md`
- `skills/engineering/plan/SKILL.md`
- `scripts/validate-docs.ts`, `scripts/audit-docs.ts`, `scripts/__tests__/audit-docs.test.ts`
- `extensions/qmd/domain/onboarding.ts`
- `lib/extension-runtime/conditional-feature.ts` and its adjacent documentation target

## 4. Detailed design

### 4.1 Memory categories

The repo keeps five active documentation categories plus small supporting references:
- Domain memory → `CONTEXT.md`
- Decision memory → `docs/adr/` and narrowly-used planning artifacts
- Method memory → `skills/**` and supporting references
- Architecture overview → `docs/ARCHITECTURE.md`
- Agent configuration → `docs/agents/`

Cross-cutting stable references remain allowed for coding conventions and testing conventions.

### 4.2 Entry surfaces

Keep all four entry surfaces, but narrow them:
- `README.md` → package intro, install, development basics
- `AGENTS.md` → agent operating map
- `docs/README.md` → documentation category map
- `docs/ARCHITECTURE.md` → stable bird's-eye overview plus where to look next

### 4.3 Obsolete docs

Retire `docs/QUALITY.md`, `docs/CONTRIBUTING-DOCS.md`, and `docs/reports/` in the same change that reroutes all active dependencies.

### 4.4 References

- `docs/references/` keeps only shared repo-wide references.
- Owned references move next to the module, skill, or extension they explain.
- The conditional feature helper reference should move out of top-level docs and become owner-adjacent under `lib/extension-runtime/`.

### 4.5 Planning artifacts

`docs/specs/` and `docs/exec-plans/` stay available only for genuinely complex, multi-session, or architecture-shaping work. GitHub issues remain the canonical backlog.

### 4.6 Structural enforcement

`check:docs` should validate the new structure:
- required entry surfaces exist
- `CONTEXT.md` exists
- `docs/coding-conventions.md` exists
- `docs/DESIGN-PRINCIPLES.md` exists
- extension README requirements still hold
- retired docs/categories are forbidden
- top-level `docs/references/` contains only approved shared references

The separate audit script and its command should be removed.

## 5. Testing strategy

### 5.1 Unit tests

- Update validation tests to cover new structural rules.
- Remove audit-script-specific tests.

### 5.2 Manual validation

- Run `bun run check:docs`
- Run `bun run check:boundaries`
- Run `bun run test`

## 6. Implementation checklist

- [ ] Create planning artifacts for this cleanup and link them
- [ ] Rewrite entry surfaces
- [ ] Add coding conventions doc
- [ ] Slim architecture/design/testing/reference docs to fit the new model
- [ ] Update skills/onboarding/tooling dependencies
- [ ] Move owned reference(s) next to their owner
- [ ] Replace audit script with structural validation checks
- [ ] Delete obsolete docs/categories
- [ ] Run validation/tests

## 7. Open questions

- Whether `docs/specs/` and `docs/exec-plans/` should later be phased down further in favor of GitHub-native planning remains intentionally open.
