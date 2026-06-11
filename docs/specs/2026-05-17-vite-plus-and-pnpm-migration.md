# Vite+ and pnpm migration

Status: Draft
Date: 2026-05-17
Execution plan: [[docs/exec-plans/active/2026-05-17-vite-plus-and-pnpm-migration.md]]

## 1. Problem statement

This repository is currently standardized around Bun-driven scripts and documentation, but the desired future state is a pnpm-managed project that uses Vite+ as the primary toolchain surface. The migration needs to preserve the repository's existing validation behavior for a Pi package repo while replacing the package-manager and tool-invocation conventions that currently assume Bun.

A successful migration also includes aligning repository docs and workflow guidance so downstream agents and humans are not told to keep using Bun after the toolchain has moved.

## 2. Goals and non-goals

### 2.1 Goals

- Move the repo from Bun-first package management to pnpm with an explicit `packageManager` declaration.
- Adopt Vite+ as the primary command surface for install, check, test, lint, format, and related workflows.
- Preserve existing quality gates: docs validation, boundary validation, Biome checks, and tests.
- Update repo guidance so package-manager and validation instructions match the new workflow.
- Verify the migrated repo with the recommended Vite+ validation loop.
- Upgrade the globally installed pnpm to a version in the 11.x line or newer.

### 2.2 Non-goals

- Convert the repository into a frontend app or add a runtime build pipeline for Pi extensions.
- Rewrite extension runtime code that is unrelated to the toolchain migration.
- Rework the repository into a monorepo.
- Replace Biome, Lefthook, or Vitest unless Vite+ migration requires a configuration move.

## 3. System context

Affected surfaces:
- `package.json` scripts and package-manager metadata
- lockfile and install workflow
- `vitest.config.ts` / any test imports that Vite+ wants rewritten
- repo docs: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN-PRINCIPLES.md`, `docs/coding-conventions.md`, `docs/TESTING.md`, README-level install/development instructions
- hook/config files that may be merged into `vite.config.ts`

Important current constraints:
- Pi loads TypeScript directly; there is still no extension build step.
- The repo currently uses Vitest 4.x and Biome, which should remain intact conceptually even if invocation changes.
- Repository guidance currently hard-codes Bun usage and will become incorrect after migration.

## 4. Conventions and style

- Follow the Vite+ migration guide and command mapping from `https://viteplus.dev/guide/migrate`.
- Preserve the repo's current validation semantics where possible, but invoke them through Vite+ or pnpm-compatible scripts.
- Keep the migration minimally invasive: change toolchain surfaces first, not domain code.
- Prefer generated/default Vite+ structure where it fits, then tighten docs and scripts manually.

## 5. Detailed design

### 5.1 Package-manager migration

The repo should declare pnpm explicitly via `packageManager` and replace Bun-specific lockfile/workflow assumptions with pnpm equivalents. The install path should be reproducible for both local development and CI.

### 5.2 Vite+ command-surface migration

Run `vp migrate --no-interactive` in the repo root, then manually review its output. The repo should expose a Vite+ first workflow for install/check/test/lint/format while preserving custom repo validation commands such as docs and boundary checks.

### 5.3 Config consolidation

If Vite+ introduces `vite.config.ts`, it should become the canonical place for toolchain config that Vite+ expects to own. Existing standalone config should remain only where necessary and should be cross-checked against the migration guide.

### 5.4 Documentation alignment

All Bun-only guidance must be replaced with pnpm/Vite+ guidance, especially in files that shared skills consult first. Durable repo guidance should no longer claim Bun-only usage once the migration is complete.

### 5.5 Global pnpm upgrade

Upgrade the globally installed pnpm from the current 10.x version to the latest 11.x-or-newer version. Record the command used and verify the resulting version.

## 6. Error handling and failure modes

- If `vp migrate` produces changes that break validation, keep the generated structure but repair scripts/config manually rather than partially reverting to Bun.
- If Vite+ does not fully absorb a repo-specific check, keep that check as a script and invoke it through `vp run`/pnpm rather than dropping it.
- If global pnpm upgrade method depends on the local environment, prefer the least invasive successful upgrade path and verify with `pnpm --version`.

## 7. Security and safety considerations

- The global pnpm upgrade changes developer-machine tooling, so verification must be explicit.
- Avoid modifying unrelated runtime code or untracked user work while migrating shared configs and docs.

## 8. Testing strategy

### 8.1 Unit tests

Existing Vitest suites must still pass after migration.

### 8.2 Integration tests

Validation should include:
- dependency install success
- Vite+ check/test/build commands succeeding or being intentionally scoped for this package repo
- repo-specific docs and boundary validators still passing

## 9. Implementation checklist

- [ ] Create migration artifacts and capture constraints.
- [ ] Upgrade global pnpm to 11+ and verify version.
- [ ] Run `vp migrate --no-interactive` and inspect generated changes.
- [ ] Repair scripts/config/package metadata for this repo's Pi-package workflow.
- [ ] Update docs and repo instructions from Bun-first to pnpm/Vite+.
- [ ] Validate with install/check/test/build flows and repo-specific checks.

## 10. Open questions

- Whether Vite+ will generate hook or agent files that should be kept, merged, or declined in this repo.
- Whether `vp build` / `vp pack` is the more appropriate acceptance command for a Pi package repo with no frontend build output.
