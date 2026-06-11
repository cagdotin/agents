# Vite+ and pnpm migration — Implementation plan

Status: Active
Owner: agent
Created: 2026-05-17
Spec: [[docs/specs/2026-05-17-vite-plus-and-pnpm-migration.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Migrate this Pi package repository from Bun-first workflows to pnpm + Vite+ without losing the current validation behavior. After the change, a newcomer should be able to install dependencies with pnpm, run the repository checks through either pnpm or the Vite+ task runner, and use `vp test` for the built-in Vite+ Vitest loop. This plan also covers upgrading the globally installed pnpm from 10.2.0 to 11.x or newer.

## Progress

- [x] (2026-05-17 10:40 local) Read the Vite+ migration guide, current package metadata, and current repo architecture/tooling docs.
- [x] (2026-05-17 10:45 local) Captured the migration intent and constraints in a spec and this execution plan.
- [x] (2026-05-17 10:46 local) Upgraded global pnpm to 11.1.2 with Homebrew and verified the active version.
- [x] (2026-05-17 10:47 local) Ran `vp migrate --no-interactive` in the repo root and inspected the generated config/script changes.
- [x] (2026-05-17 10:53 local) Repaired repo-specific scripts, docs, and config so the Pi package remains valid under pnpm + Vite+.
- [x] (2026-05-17 10:53 local) Validated the migrated workflow with `vp install`, `pnpm run check`, `vp run check`, `vp test`, `vp run build`, and `vp run pack`.

## Surprises & Discoveries

- Observation: the repository had no existing `vite.config.ts`; its toolchain surface was mostly `package.json` scripts plus standalone config files.
  Evidence: top-level scan found `package.json`, `lefthook.yml`, `tsconfig.json`, and `bun.lock`, but no Vite/Vite+ config file before the migration.

- Observation: Vite+ was already available globally as `vp v0.1.21`, but the local package dependency was not installed yet.
  Evidence: `vp --version` succeeded and reported `Local vite-plus: Not found` before migration.

- Observation: current durable repo docs hard-coded Bun as an invariant, so the migration had to include doc and methodology updates rather than only package metadata changes.
  Evidence: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN-PRINCIPLES.md`, `docs/coding-conventions.md`, and `docs/TESTING.md` all described Bun-first workflow before the edits.

- Observation: `pnpm` 11 initially aborted non-interactive installs because the repository had an older store layout and build-script approvals were pending.
  Evidence: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, and `ERR_PNPM_IGNORED_BUILDS` appeared during the first install attempts after the global pnpm upgrade.

- Observation: `prepare: lefthook install` made repeatable `pnpm install` validation brittle in this environment, so hook installation had to become an explicit manual step.
  Evidence: repeated `pnpm install` runs failed with `.git/hooks/pre-commit` replacement/removal errors until the `prepare` script was removed.

- Observation: built-in `vp build` and `vp pack` are not meaningful for this repository because Pi consumes source TypeScript and markdown resources directly.
  Evidence: `vp build` failed looking for `index.html`, and `vp pack` failed looking for a library entrypoint such as `src/index.ts`.

## Decision Log

- Decision: create both a spec and an execution plan before implementation.
  Rationale: this is a repo-wide tooling migration that changes durable workflow conventions and spans several classes of files.
  Date/Author: 2026-05-17 / agent

- Decision: use `vp migrate --no-interactive` as the baseline migration step, then manually adapt the repo-specific Pi-package workflow.
  Rationale: this matches the Vite+ migration guide and reduces hand-rolled divergence from the intended toolchain shape.
  Date/Author: 2026-05-17 / agent

- Decision: keep Biome as the repo-specific formatter/linter gate instead of forcing immediate `vp check` parity.
  Rationale: the repository passes its current validation with Biome, docs validation, boundary validation, and tests, while Vite+'s default format/type-aware lint path surfaces a much larger tightening task that is separate from this migration.
  Date/Author: 2026-05-17 / agent

- Decision: provide repo-defined `build` and `pack` scripts that intentionally no-op with explanatory messages.
  Rationale: this preserves a coherent Vite+ task-runner surface (`vp run build`, `vp run pack`) without pretending the Pi package has a frontend or library build step.
  Date/Author: 2026-05-17 / agent

## Outcomes & Retrospective

Completed outcomes:
- Global pnpm upgraded from `10.2.0` to `11.1.2`.
- Repo package-manager metadata migrated to `packageManager: pnpm@11.1.2`.
- `vp migrate --no-interactive` applied the initial Vite+ migration.
- Test imports/config now route through Vite+ (`vite-plus/test`, `vite.config.ts`, `vp test`).
- `bun.lock` was retired in favor of `pnpm-lock.yaml`.
- Durable repo docs now describe pnpm + Vite+ instead of Bun-only workflow.
- Canonical repo validation passes through `pnpm run check`, and the same full gate is reachable through `vp run check`.

Preserved exceptions:
- Biome remains the repo-specific formatter/linter gate; Vite+ is used here primarily as package-manager/task surface and Vitest integration, not as a drop-in replacement for every existing repo rule.
- Built-in `vp build` / `vp pack` remain non-applicable for this Pi package, so repo-defined `build` and `pack` scripts intentionally explain that there is no build step.

Remaining follow-up:
- If you later want full `vp check` parity, that is a separate tightening task because the repo's current source set does not yet satisfy Vite+'s stricter default formatting/type-aware lint expectations.

## Context and orientation

Final important files:
- `package.json` — migrated pnpm/Vite+ script surface and `packageManager` declaration
- `pnpm-lock.yaml` — canonical lockfile after migration
- `pnpm-workspace.yaml` — Vite+ catalog metadata introduced by migration
- `vite.config.ts` — canonical Vite+ config, now carrying the Vitest config used by `vp test`
- `vitest.config.ts` — compatibility re-export pointing at `vite.config.ts`
- `AGENTS.md` — repo-local operating rules, updated for pnpm + Vite+
- `docs/ARCHITECTURE.md`, `docs/DESIGN-PRINCIPLES.md`, `docs/coding-conventions.md`, `docs/TESTING.md`, `docs/README.md`, `README.md` — durable toolchain guidance updated for pnpm + Vite+

External references summarized for this plan:
- `vp migrate --no-interactive` updates dependencies, rewrites imports when needed, merges tool-specific config into `vite.config.ts`, updates scripts, and can set up hooks.
- Vite+ delegates package-manager operations through the `packageManager` field, so pnpm version and metadata must be correct.
- For this repo, the canonical full validation gate is `pnpm run check` / `vp run check`, while `vp test` is the main built-in Vite+ command that remains directly applicable.

## Plan of work

1. Upgrade the global pnpm installation to a verified 11.x-or-newer version.
2. Run the non-interactive Vite+ migration in the repository root.
3. Repair repo-specific mismatches: Pi package scripts, docs, and hook/install behavior.
4. Replace Bun-first durable guidance with pnpm/Vite+-first guidance.
5. Validate the end state with repo-appropriate pnpm/Vite+ commands.

## Concrete steps

From repo root `/Users/cgn/git/dev/0xcgn/agents` unless noted otherwise:

1. Check current tooling:
   - `pnpm --version`
   - `vp --version`
2. Upgrade global pnpm:
   - `brew upgrade pnpm`
   - re-run `pnpm --version`
3. Run migration:
   - `vp migrate --no-interactive`
4. Repair workflow:
   - resolve pnpm 11 store/build-approval issues
   - add `tsx` for repo TypeScript scripts
   - merge Vitest config into `vite.config.ts`
   - remove the brittle `prepare` hook-install step
   - update docs and scripts
5. Validate:
   - `vp install`
   - `pnpm run check`
   - `vp run check`
   - `vp test`
   - `vp run build`
   - `vp run pack`

## Validation and acceptance

Acceptance requires all of the following:
- `pnpm --version` reports 11.x or newer.
- The repo declares pnpm in `packageManager`.
- Bun-first install/check/test documentation has been replaced with pnpm/Vite+ guidance.
- Repo validation passes through `pnpm run check` and `vp run check`.
- Any Vite+/pnpm-generated config left in the repo is intentional and explained by the resulting workflow.
- `vp run build` and `vp run pack` succeed with explicit no-build messaging appropriate for this Pi package repo.

## Idempotence and recovery

- Re-running `vp migrate --no-interactive` may re-touch generated files; inspect diffs carefully before repeating it.
- If global pnpm upgrade path fails, choose a different installation mechanism and verify the active binary path before continuing.
- If Vite+ introduces an unsuitable script/config default, prefer manual adjustment over deleting the Vite+ config entirely.
- If `pnpm` asks for build-script approval on a fresh machine, run `pnpm approve-builds --all` before re-running the install.

## Artifacts and notes

Validation evidence:
- `pnpm --version` → `11.1.2`
- `vp install` → success
- `pnpm run check` → success
- `vp run check` → success
- `vp test` / `pnpm run test` → success
- `vp run build` → prints intentional no-build message
- `vp run pack` → prints intentional no-pack message

## Interfaces and dependencies

Final interfaces:
- `package.json` exposes pnpm/Vite+-compatible scripts and `packageManager` metadata.
- `vite.config.ts` owns the Vite+ Vitest config.
- Repo docs instruct humans and agents to use pnpm/Vite+ commands instead of Bun.
- Existing Pi package manifest under the `pi` key in `package.json` remains intact.
