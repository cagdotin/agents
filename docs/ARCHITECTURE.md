# ARCHITECTURE

Status: active
Last updated: 2026-04-30

---

## Bird's eye

This repository is a **Pi package**: a versioned bundle of extensions, skills, themes, and support docs for coding agents. Pi discovers package resources through the `pi` manifest in `package.json`.

## Major parts

### `extensions/`

Runtime code loaded by Pi at startup. Each extension lives in its own directory and must have a README.

### `skills/`

Reusable instruction bundles. Skills are markdown playbooks, not runtime code.

### `pi-themes/`

Theme JSON files distributed with this package.

### `lib/`

Shared TypeScript helpers for extension runtime code. These modules exist to prevent cross-extension runtime coupling.

### `docs/`

Support docs organized by memory type:
- `ARCHITECTURE.md` — stable bird's-eye overview
- `DESIGN-PRINCIPLES.md` — enduring design constraints
- `coding-conventions.md` — naming and style rules
- `TESTING.md` — repo-specific testing conventions
- `adr/` — durable decision memory
- `specs/` and `exec-plans/` — planning artifacts for genuinely complex work
- `agents/` — repo-local configuration for shared skills
- `references/` — shared repo-wide references only

### `scripts/`

Validation and automation run through `pnpm run` and the Vite+ command surface.

### `.graveyard/`

Retired extensions and modules kept only as rebuild specs and reference summaries.

### `.pi/`

Runtime state managed by extensions, not source code.

## Boundaries

- **Source vs runtime:** `extensions/`, `skills/`, `lib/`, and `docs/` are source. `.pi/` is generated runtime state and should not be treated as package source.
- **Extensions vs skills:** extensions execute at runtime; skills are static guidance loaded on demand.
- **Shared vs owned references:** top-level `docs/references/` is only for repo-wide references. References with a natural owner belong next to that module, skill, or extension.
- **Backlog vs planning artifacts:** GitHub issues are the backlog. `docs/specs/` and `docs/exec-plans/` are reserved for genuinely complex, multi-session, or architecture-shaping work.

## Invariants

1. **AGENTS.md is a map, not an encyclopedia.**
2. **No cross-extension runtime dependencies.** Extract shared utilities only when the need is clearly repeated.
3. **pnpm + Vite+ workflow.** Use `pnpm` for package management and `vp` for the standard toolchain commands throughout code and docs.
4. **No build step for extensions.** Pi loads TypeScript directly.
5. **Every extension has a README.**
6. **Important decisions must live in repo files.** Domain language belongs in `CONTEXT.md`; durable trade-offs belong in ADRs.

## Where to look next

- Need vocabulary? Read `CONTEXT.md`.
- Need stable rationale? Read `docs/adr/` and `docs/DESIGN-PRINCIPLES.md`.
- Need conventions? Read `docs/coding-conventions.md` and `docs/TESTING.md`.
- Need implementation-facing shared references? Read `docs/references/`.
- Need a module-specific pattern? Look next to the owning module, skill, or extension.
