# Skill taxonomy refinement and reference normalization

Status: Draft
Date: 2026-04-30
Execution plan: [[docs/exec-plans/completed/2026-04-30-skill-taxonomy-refinement-and-reference-normalization.md]]

## 1. Problem statement

The repository now has categorized package skills, but the taxonomy still has one awkward placement: `github` sits under `engineering`, while browser-driven and transcript-oriented skills sit under `research`. The user wants a review of the taxonomy and suggested that `github` may fit better under a `tools` category.

They also want historical docs normalized so repository references consistently use the current categorized skill paths instead of legacy flat paths.

## 2. Goals and non-goals

### 2.1 Goals

- Refine the package-skill taxonomy to better separate methodologies from tool/integration workflows.
- Rename or add categories where doing so improves clarity.
- Normalize current and historical repository docs to use current categorized skill paths.
- Preserve skill names and Pi discovery behavior.

### 2.2 Non-goals

- Rewrite skill behavior.
- Rename `/skill:name` identifiers.
- Change extension-owned skills.
- Rewrite unrelated prose that does not mention skill locations or taxonomy.

## 3. System context

### Current taxonomy candidates

- `engineering` currently mixes methodologies (`plan`, `review`, `improve-codebase-architecture`) with an external workflow integration (`github`).
- `research` currently contains `browser` and `youtube-transcript`, which are also tool/integration oriented.

### Proposed taxonomy

- `skills/engineering/`
  - `plan`
  - `review`
  - `improve-codebase-architecture`
- `skills/productivity/`
  - `caveman`
  - `grill-me`
  - `write-a-skill`
- `skills/tools/`
  - `github`
  - `browser`
  - `youtube-transcript`

## 4. Detailed design

### 4.1 Taxonomy rationale

Use `engineering` for thinking frameworks and reusable engineering methodologies.
Use `productivity` for communication and meta-workflow accelerators.
Use `tools` for skills whose main purpose is operating external systems, CLIs, browsers, or content-extraction integrations.

This separates:
- method from interface
- judgment workflows from operator tooling
- repo-internal practice from external-system control

### 4.2 Move strategy

- `skills/engineering/github/` → `skills/tools/github/`
- `skills/research/browser/` → `skills/tools/browser/`
- `skills/research/youtube-transcript/` → `skills/tools/youtube-transcript/`
- retire the `research` category in favor of `tools`

### 4.3 Reference normalization

Normalize repository references to current paths in:
- `AGENTS.md`
- `README.md`
- docs under `docs/specs/`
- docs under `docs/exec-plans/`
- current category READMEs and moved skill READMEs

Normalize both:
- path references like `skills/engineering/plan/PLAN.md`
- category references like `skills/tools/`

## 5. Error handling and failure modes

- Preserve directory basenames so skill frontmatter names remain valid.
- Do not leave mixed `research` and `tools` references in docs after the rename.
- Keep replacements scoped to repository-authored docs and skill docs; do not edit vendored `node_modules` content.

## 6. Testing strategy

- Run `bun run check:docs`
- Run `bun run check:boundaries`
- Run `bun run test`
- Run `bun run check` and record any unrelated blockers
- Re-run path search to confirm current docs no longer reference old flat paths or the retired `research` category

## 7. Implementation checklist

- [ ] Create spec and execution plan
- [ ] Move tool/integration skills into `skills/tools/`
- [ ] Update category README indexes
- [ ] Normalize historical and current doc references
- [ ] Run validation and search-based verification

## 8. Open questions

- None currently.
