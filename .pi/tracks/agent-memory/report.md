# Report

## Status: spec and rollout plan revised; implementation not started

Research and CLI setup are done. The QMD extension design was reviewed and then tightened around cleaner boundaries before implementation begins.

## What changed in this revision

1. **Module shape simplified**
   - moved from a broader Core / Features / Extension split to a smaller set of deeper modules
   - new shape centers on:
     - `core/qmd-store.ts`
     - `core/types.ts`
     - `core/errors.ts`
     - `domain/repo-binding.ts`
     - `domain/freshness.ts`
     - `domain/onboarding.ts`
     - `extension/runtime.ts`
     - `extension/command.ts`
     - `extension/tool.ts`

2. **Source-of-truth model clarified**
   - QMD store owns collections and contexts
   - `.pi/qmd.json` is now only a repo-binding + freshness marker
   - this removes duplicated config truth from the design

3. **Repo identity made path-based**
   - canonical identity is the normalized repo root path
   - basename collision handling was removed from the design
   - collection keys remain path-derived, but encoded to satisfy QMD collection-name constraints

4. **Validation doctrine tightened**
   - Zod is now the default/runtime authority for file and proposal validation
   - TypeBox is limited to the Pi tool-registration boundary

5. **Init flow made more deterministic**
   - old direction: scan → LLM proposes config from raw context
   - revised direction: scan → deterministic draft → LLM refines with user → normalize/validate → execute

6. **Update behavior narrowed**
   - `/qmd update` is explicitly scoped to the current repo collection only
   - no global reindexing by default

7. **Footer behavior made quieter**
   - indexed repos show status
   - non-indexed repos stay silent

## Current implementation target

**Milestone 1: Core + Contracts**

Immediate next work:
- scaffold extension directories
- implement `core/errors.ts`
- implement `core/types.ts` with Zod-first schemas
- implement `core/qmd-store.ts`
- verify SDK import from the extension
- confirm the path-derived collection-key encoding

## Stable decisions at this point

- QMD remains the right retrieval engine for this work
- the extension should be infrastructure, not an always-on search tool
- the agent should continue using `bash` + `qmd query/search/get`
- path-based repo identity is the correct model
- `.pi/qmd.json` must stay small and local
- v1 should prefer deterministic, visible behavior over hidden automation

## Open constraints still worth validating during implementation

- benchmark `store.listCollections()` latency in real usage
- verify the chosen path-encoding format is ergonomic enough in CLI output/prompt text
- confirm embed progress UX for `/qmd init`
- decide later whether non-git freshness fallback is worth the added complexity
