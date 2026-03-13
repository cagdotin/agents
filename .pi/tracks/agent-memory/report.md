# Report

## Status: QMD extension v1 implemented and validated in-repo

The QMD extension now exists under `extensions/qmd/` with the revised deep-module architecture from the v1 spec. Repo checks pass, the extension is documented, and focused tests cover contracts, onboarding, freshness, store wrapping, and runtime injection.

## What shipped

1. **Core layer implemented**
   - `extensions/qmd/core/errors.ts`
   - `extensions/qmd/core/types.ts`
   - `extensions/qmd/core/qmd-store.ts`
   - Zod now owns runtime validation for marker files and onboarding payloads; TypeBox is only used for the `qmd_init` tool boundary.

2. **Repo binding model implemented**
   - `domain/repo-binding.ts` resolves the normalized repo root, derives path-based collection keys, reads/writes `.pi/qmd.json`, and reconciles marker/store state.
   - Detection is path-based and can still recognize legacy collection names by repo root, surfacing a repair warning instead of silently failing.

3. **Freshness implemented**
   - `domain/freshness.ts` compares the indexed commit against the current git worktree.
   - It reports `fresh`, `stale`, or `unknown` and includes markdown path counts when stale.

4. **Deterministic onboarding implemented**
   - `domain/onboarding.ts` now handles scan → draft → prompt → normalize → execute.
   - The repo scan is bounded and prompt-safe.
   - `execute_init()` adds the collection, writes contexts, updates only that collection, embeds only when needed, and writes `.pi/qmd.json`.

5. **Extension wiring implemented**
   - `extension/runtime.ts` refreshes state on session lifecycle events, keeps the footer quiet for non-indexed repos, injects short QMD CLI guidance when indexed, and closes the store on shutdown.
   - `extension/command.ts` provides `/qmd status`, `/qmd update`, and `/qmd init`.
   - `extension/tool.ts` registers `qmd_init`, keeps it inactive by default, activates it only during onboarding, and always removes it in `finally`.

6. **Docs + tests added**
   - `extensions/qmd/README.md`
   - `extensions/qmd/docs/architecture.md`
   - `extensions/qmd/docs/onboarding.md`
   - `extensions/qmd/docs/freshness.md`
   - `extensions/qmd/__tests__/...`

## Validation

- `bun run check` ✅
- SDK import from `@tobilu/qmd` works in this repo via the linked local fork
- Full repo test suite passes with the new extension included

## Implementation learnings

- **Legacy collection compatibility matters.** The current repo already had a manual `agents` collection, so repo-root fallback plus repair warnings is the right practical bridge into the stricter v1 model.
- **Freshness must compare against the worktree, not just `HEAD`.** Using `git diff <indexed_commit>` plus an untracked markdown pass catches local edits correctly.
- **Workflow-scoped tool activation is viable for v1.** The extension can safely add/remove only `qmd_init` without taking ownership of global tool state.

## Still worth checking later

- benchmark `store.listCollections()` latency in a live non-test session
- evaluate whether legacy collection bindings should get an explicit migration command in v2
- decide whether non-git freshness fallback is worth the extra complexity
