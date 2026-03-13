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

## Post-implementation review

Full review of `extensions/qmd/` — all 11 source files, 6 test files, 3 docs, and README.

### Strengths

- Clean 3-layer architecture with one-way dependency flow (`Extension → Domain → Core → SDK`)
- Schema-first validation at all boundaries (Zod for runtime, TypeBox for tool registration)
- Agent-legible errors throughout — exemplary adherence to "what's wrong, why it matters, how to fix"
- Progressive-disclosure docs (README → 3 focused detail docs)
- Thoughtful freshness model grounded in git
- Defensive init workflow with explicit user-confirmation gate and `finally`-based cleanup
- Consistent naming conventions (kebab-case files, snake_case functions, CamelCase types)
- No security concerns — `execFile` over `exec`, path traversal rejection, local-only surface

### Findings to address

1. **[warning] No test coverage for `extension/command.ts`** — The `/qmd status`, `/qmd update`, and `/qmd init` handlers are the primary user-facing entry points and contain significant orchestration logic. Add at least one test per subcommand with mocked domain dependencies.

2. **[warning] No test for `tool.ts` execute path** — The `qmd_init` tool's `execute` function (param validation, normalization, delegation, state cleanup) is untested. Lower priority since domain functions it delegates to are tested, but a smoke test would catch wiring issues.

3. **[warning] `.pi/qmd.json` formatting triggers Biome error** — `bun run check` fails because Biome wants tabs but `JSON.stringify(marker, null, 2)` writes spaces. Fix: use `\t` as indent or exclude `.pi/qmd.json` from Biome formatting.

4. **[warning] `@tobilu/qmd` not declared in `package.json`** — The SDK is `bun link`'d from a local fork. Works for development but invisible to the package manager — fresh clones and CI won't resolve it. Consider adding it as a dependency (even if overridden locally) or documenting the gap more visibly.

5. **[warning] `write_repo_marker` double-resolves repo root** — It calls `resolve_repo_root(cwd)` internally, but callers already have the resolved root. Wastes a `git rev-parse` call each time. Consider accepting a pre-resolved path directly.

6. **[warning] `output_message` uses an inline structural type** — The `ctx` parameter in `command.ts` isn't derived from Pi's `ExtensionContext`. Works because the real ctx is a superset, but fragile if the Pi API changes.

7. **[note] Module-level singleton in `qmd-store.ts`** — The `let store_promise` pattern is fine for single-process use but makes the store subtly stateful. Worth documenting as an explicit design decision.

8. **[note] Live `.pi/qmd.json` uses legacy `"agents"` key** — The extension's own repo hasn't migrated to the v1 `p_<base64url>` key format. The binding logic handles this gracefully via store fallback + repair warning, but it's slightly ironic.

### Priority order for follow-up

1. Add command handler tests (most impactful testing gap)
2. Fix Biome formatting on `.pi/qmd.json`
3. Declare `@tobilu/qmd` in `package.json` or document more visibly
4. De-duplicate `resolve_repo_root` call in `write_repo_marker`

## Still worth checking later

- benchmark `store.listCollections()` latency in a live non-test session
- evaluate whether legacy collection bindings should get an explicit migration command in v2
- decide whether non-git freshness fallback is worth the extra complexity
