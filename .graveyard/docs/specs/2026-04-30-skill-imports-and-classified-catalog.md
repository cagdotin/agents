# Skill imports and classified catalog

Status: Draft
Date: 2026-04-30
Execution plan: [[docs/exec-plans/completed/2026-04-30-skill-imports-and-classified-catalog.md]]

## 1. Problem statement

The repository currently ships a small flat set of package-wide skills under `skills/`. The user wants four skills from `mattpocock/skills` added to this package:

- `caveman`
- `grill-me`
- `write-a-skill`
- `improve-codebase-architecture`

They also want the skills to feel more classified, similar to Matt Pocock's `engineering/` and `productivity/` grouping.

Two constraints shape the work:

- This repository's docs validator currently assumes a flat `skills/<name>/SKILL.md` layout.
- Imported skills should be adapted where needed so relative references resolve locally and instructions match this harness's available capabilities.

## 2. Goals and non-goals

### 2.1 Goals

- Add the four requested skills to this package.
- Introduce an initial classified skills layout under `skills/engineering/` and `skills/productivity/`.
- Preserve Pi package compatibility by relying on recursive `SKILL.md` discovery under `skills/`.
- Update local validation so categorized skill directories are supported.
- Add lightweight category documentation so humans and agents can browse the new grouped structure.
- Keep imported content agent-legible and close to upstream intent while fixing broken local references and obviously harness-specific mismatches.

### 2.2 Non-goals

- Reorganize every existing legacy skill in this repository into categories.
- Build a full evaluation loop for the imported skills in this session.
- Introduce runtime code or extensions for skill categorization.
- Copy unrelated upstream skills beyond the four requested ones and any minimal support references needed to make them self-contained.

## 3. System context

### Affected areas

- `skills/` — new categorized skill directories and category READMEs
- `scripts/validate-docs.ts` — recurse through categorized skills instead of assuming one flat level
- `scripts/__tests__/validate-docs.test.ts` — cover nested skill discovery
- `README.md` and repo docs — mention the classified catalog structure where useful

### Relevant conventions

- Pi recursively discovers skill directories containing `SKILL.md` under package `skills/` paths.
- `SKILL.md` frontmatter `name` must match the immediate parent directory.
- File and folder names should use kebab-case, except required convention files like `SKILL.md` and `README.md`.
- Skills are static markdown; no runtime code is needed for these imports.

## 4. Detailed design

### 4.1 Skill placement

Create these new skill directories:

- `skills/productivity/caveman/`
- `skills/productivity/grill-me/`
- `skills/productivity/write-a-skill/`
- `skills/engineering/improve-codebase-architecture/`

This mirrors the requested classification pattern without disturbing existing flat skills.

### 4.2 Imported content policy

Use upstream content as the starting point, but adapt when necessary to satisfy repository and harness constraints:

- convert support file names to kebab-case
- keep all relative links local and valid
- replace references to unavailable tools with repo-agnostic guidance such as inline exploration or optional subagents when available
- add provenance in category documentation rather than bloating skill frontmatter

### 4.3 Validator update

Replace the current one-level scan of `skills/` with recursive discovery of directories containing `SKILL.md`.

Rules:
- category directories without `SKILL.md` are containers, not errors
- skip `node_modules` and hidden directories
- once a directory is recognized as a skill root, validate it and do not recurse into it

### 4.4 Documentation

Add `skills/engineering/README.md` and `skills/productivity/README.md` as category indexes.
Update top-level repository docs only where they should acknowledge that `skills/` may now contain grouped subdirectories.

## 5. Error handling and failure modes

- Broken relative links in imported markdown are treated as implementation bugs and must be fixed before completion.
- Validator recursion must not descend into dependency directories such as `node_modules`, or false-positive skill discovery can occur.
- If an upstream reference depends on an unimported sibling skill, copy the minimal referenced support material into the local imported skill instead of leaving dangling links.

## 6. Testing strategy

### 6.1 Unit tests

- Extend `scripts/__tests__/validate-docs.test.ts` with a nested-skill fixture.

### 6.2 Integration tests

- Run `bun run check:docs`.
- Run full `bun run check` if the local environment is healthy.

## 7. Implementation checklist

- [ ] Create spec and execution plan
- [ ] Update docs validator for recursive skill discovery
- [ ] Add validator coverage for nested categorized skills
- [ ] Import `caveman`, `grill-me`, and `write-a-skill` under `skills/productivity/`
- [ ] Import `improve-codebase-architecture` plus required support references under `skills/engineering/`
- [ ] Add category README indexes and adjust repo docs for the new classified layout
- [ ] Run validation and record results

## 8. Open questions

- Whether existing legacy flat skills should later migrate into categories is intentionally deferred.
