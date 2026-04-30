# Legacy skill categorization

Status: Draft
Date: 2026-04-30
Execution plan: [[docs/exec-plans/completed/2026-04-30-legacy-skill-categorization.md]]

## 1. Problem statement

The repository now has an initial categorized skill layout for newly imported skills, but the older package-wide skills still live flat under `skills/`. The user wants phase 2: move those legacy skills into categories as well so the catalog is consistently classified.

Current uncategorized legacy skills:

- `browser`
- `github`
- `plan`
- `review`
- `youtube-transcript`

The work must preserve Pi discovery behavior, keep skill names unchanged, and avoid breaking local references in active repository docs.

## 2. Goals and non-goals

### 2.1 Goals

- Move the legacy flat skills into category subdirectories.
- Keep each skill directory name unchanged so frontmatter names and `/skill:name` behavior remain stable.
- Add any missing category index documentation needed to make the catalog browsable.
- Update current repository docs and local path references that should point at the moved skills.
- Keep validation and tests green except for already-known unrelated blockers.

### 2.2 Non-goals

- Rename skill identifiers.
- Rewrite the content or behavior of the moved skills beyond path-fixups and catalog docs.
- Exhaustively rewrite historical references in every completed plan/spec unless needed for current navigation.
- Introduce extension-based dynamic categorization.

## 3. System context

### Affected areas

- `skills/` — move existing skill directories into categories
- `AGENTS.md` and current docs — update stable path references
- category READMEs — expand indexes to include moved skills
- skill-local READMEs — fix any path examples that mention their on-disk location

### Category mapping

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

### 4.1 Move strategy

Physically move each legacy skill directory into its target category directory:

- `skills/github/` → `skills/tools/github/`
- `skills/plan/` → `skills/engineering/plan/`
- `skills/review/` → `skills/engineering/review/`
- `skills/browser/` → `skills/tools/browser/`
- `skills/youtube-transcript/` → `skills/tools/youtube-transcript/`

Because Pi discovers recursively and the skill directory basename stays the same, skill identity remains stable.

### 4.2 Documentation scope

Update stable, operational references that should track the current filesystem layout, especially:

- `AGENTS.md`
- `docs/exec-plans/README.md`
- `docs/exec-plans/TEMPLATE.md`
- active execution plans
- root `README.md`
- moved skill READMEs with path examples

Historical specs and completed plans may retain period-accurate references unless a stale path would materially harm present-day navigation.

### 4.3 Category docs

Expand `skills/engineering/README.md` to include the moved engineering skills.
Create `skills/tools/README.md` for browser and transcript workflows.

## 5. Error handling and failure modes

- Do not change `name:` frontmatter values; moving is safe only if basenames remain the same.
- README examples that use `cd skills/<name>` or show old trees must be updated, or users will follow broken setup paths.
- Active docs should not keep pointing at old flat skill paths after the move.

## 6. Testing strategy

### 6.1 Validation

- Run `bun run check:docs`
- Run `bun run check:boundaries`
- Run `bun run test`

### 6.2 Acceptance checks

- `find skills -maxdepth 4 -type f | sort` shows a fully categorized catalog
- no current docs point to nonexistent moved paths for active operational guidance

## 7. Implementation checklist

- [ ] Create spec and execution plan
- [ ] Move legacy engineering skills into `skills/engineering/`
- [ ] Move legacy tool-oriented skills into categorized directories
- [ ] Update category README indexes
- [ ] Update stable doc references and moved skill README examples
- [ ] Run validation and record blockers if any

## 8. Open questions

- Historical normalization was later handled in a follow-up taxonomy/refinement pass.
