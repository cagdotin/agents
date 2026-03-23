# ARCHITECTURE

Status: active
Last updated: 2026-03-11

---

## Bird's eye

This repository is a **Pi package**: a versioned bundle of extensions, skills,
themes, and docs for coding agents. Pi discovers them through the `pi` manifest
in `package.json`.

---

## Codemap

### `extensions/`

Runtime code loaded by Pi at startup. Extensions live here, each in its own
subdirectory, and each must have a README.

### `skills/`

On-demand instruction bundles. Skills are markdown playbooks, not runtime code.

### `pi-themes/`

Theme data distributed with this package.

### `docs/`

System-of-record knowledge base for humans and agents.

- `ARCHITECTURE.md` — repository map and invariants
- `DESIGN-PRINCIPLES.md` — design principles distilled from research and practice
- `QUALITY.md` — quality scorecard and prioritized gaps
- `TESTING.md` — testing model and boundaries
- `CONTRIBUTING-DOCS.md` — rules for documentation work
- `exec-plans/` — active/completed execution plans + `tech-debt-tracker.md`
- `specs/` — implementation specs for planned or complex work
- `references/` — internal quick references
- `.graveyard/resources/` — retired resource analyses (migrated to vault)

### `scripts/`

Validation and automation run through `bun run`.

### `.graveyard/`

Retired code kept for reference. See `.graveyard/extensions/README.md` for what
was removed and why.

### `.pi/`

Runtime state managed by extensions, not source code. Notably:
- `.pi/todos/`
- `.pi/expertise/`

---

## Boundaries

- **Source vs. runtime:** `extensions/`, `skills/`, and `docs/` define behavior.
  `.pi/` is generated runtime state and gitignored.
- **Extensions vs. skills:** extensions execute at runtime; skills are static
  instructions loaded into context on demand.
- **Docs vs. code:** code is the source of truth for behavior; docs are the
  source of truth for decisions, boundaries, and where to look.

---

## Invariants

1. **AGENTS.md is a map, not an encyclopedia.** Keep the entry point short;
   details belong in `docs/` and extension READMEs. (See: [[harness-engineering-openai]])
2. **No cross-extension runtime dependencies.** Extract shared utilities only
   when the need is clearly repeated.
3. **Bun only.** Use `bun`, `bun run`, and `bunx` throughout code and docs.
4. **No build step for extensions.** Pi loads TypeScript directly.
5. **Every extension has a README.** Behavior should be discoverable without
   reading source first.
6. **Expertise is working memory, not source of truth.** `.pi/expertise/` can be
   stale; code cannot.
7. **Docs stay honest.** Gaps belong in `QUALITY.md`; planned work belongs in
   `exec-plans/` or `specs/`.

---

## Cross-cutting concerns

### Agent legibility

Important decisions must exist in repo files, not only in chat or tribal
knowledge.

### Progressive disclosure

Navigation should drill down cleanly:
`AGENTS.md` → `docs/ARCHITECTURE.md` → focused docs/READMEs → source.

### Mechanical validation

Conventions are enforced by tooling:
- `bun run check:biome`
- `bun run check:docs`
- `bun run check:boundaries`
- `bun run check`

### Testing

This repo has automated tests. For the testing model and boundaries, see
`docs/TESTING.md`.

### Naming conventions

- files and directories: `kebab-case`
- functions and variables: `snake_case`
- types and classes: `CamelCase`

### Extension patterns

All extensions follow the same structure (`index.ts`, README, types, helpers,
storage, tool). When building new extensions, match the existing conventions.
Prefer the existing validation stack: TypeBox + `StringEnum` at Pi tool
boundaries, Zod at runtime data boundaries.

---

## Packaging

`package.json` exposes this repo to Pi through the `pi` manifest:
- `skills` → `./skills`
- `extensions` → `./extensions`
- `themes` → `./pi-themes`
