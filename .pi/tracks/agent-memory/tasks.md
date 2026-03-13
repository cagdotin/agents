# Tasks

## Current focus

Build the QMD Pi extension v1 using the revised architecture:
- deeper modules
- path-based repo identity
- Zod-first validation
- deterministic onboarding draft
- repo-scoped update behavior

## Current state

Completed already: QMD research and option comparison, local QMD install via fork with Bun fixes, initial `agents` collection setup and embedding, QMD skill installation, and the revised spec/execution-plan/design-doc pass.

Remaining active work lives below.

## Active rollout: QMD Pi Extension v1

See `exec-plans/qmd-extension-v1.md` for the full checklist.

### M1: Core + Contracts
- [ ] Scaffold `core/`, `domain/`, `extension/`, `docs/`, `__tests__/`
- [ ] Add `core/errors.ts`
- [ ] Add `core/types.ts` with **Zod-first** schemas
- [ ] Add `core/qmd-store.ts`
- [ ] Verify SDK import from extension
- [ ] Confirm path-derived collection key encoding

### M2: Repo Binding + Detection
- [ ] Normalize repo root detection
- [ ] Implement `.pi/qmd.json` marker read/write
- [ ] Implement path-based binding detection
- [ ] Add marker/SDK mismatch handling

### M3: Runtime Wiring + Silent Footer
- [ ] Wire `session_start` binding + freshness checks
- [ ] Add `before_agent_start` QMD prompt injection
- [ ] Keep non-indexed repos silent
- [ ] Add `session_shutdown` store cleanup

### M4: Status + Scoped Update Command
- [ ] Implement `/qmd status`
- [ ] Implement `/qmd update` for current repo only
- [ ] Refresh marker freshness after update

### M5: Freshness Detection
- [ ] Add git-based markdown freshness detection
- [ ] Return `fresh | stale | unknown`
- [ ] Surface freshness in footer/status

### M6: Deterministic Onboarding Pipeline
- [ ] Add bounded repo scan
- [ ] Add deterministic draft proposal
- [ ] Add prompt builder for LLM refinement
- [ ] Add Zod normalization of confirmed proposal
- [ ] Execute init via SDK

### M7: Workflow Tool + Init UX Hardening
- [ ] Register `qmd_init` inactive by default
- [ ] Activate it only during `/qmd init`
- [ ] Parse tool input through Zod after Pi boundary validation
- [ ] Always deactivate in `finally`
- [ ] Document shared `setActiveTools()` caveat

### M8: Documentation + Quality Pass
- [ ] Add `README.md`
- [ ] Add `docs/architecture.md`
- [ ] Add `docs/onboarding.md`
- [ ] Add `docs/freshness.md`
- [ ] Align track docs with implementation learnings

## Future work

### Layer 3: Expertise ↔ QMD hybrid
- [ ] Thin expertise toward navigational / high-level memory
- [ ] Use QMD as deep retrieval for markdown knowledge
- [ ] Explore promotion paths from session findings → expertise append
- [ ] Explore track/expertise/QMD layering inspired by OpenViking tiering

## Architecture decisions (current)
- **One global QMD index** — single `~/.cache/qmd/index.sqlite`
- **One binding per repo root** — canonical identity is normalized repo path
- **QMD store is canonical** — marker file is not a second config system
- **Path-derived collection key** — deterministic encoding from repo root
- **Agent searches via CLI** — `bash` + `qmd query/search/get`
- **Extension uses SDK for infra only** — detection, update, status, contexts
- **Zod-first runtime validation** — TypeBox only at Pi tool registration boundary
- **Deterministic onboarding draft** — LLM refines, does not invent from scratch
- **Repo-scoped updates only** — `/qmd update` never updates all collections by default
- **Silent non-indexed footer** — show status only when indexed
- **Workflow-scoped init tool** — activate on `/qmd init`, deactivate on completion/failure

## Pending upstream
- [ ] Watch for a new QMD release that merges PR #377 and PR #385, then switch from local fork to published package.

## Known constraints
- **Bun compatibility:** currently solved by the local fork.
- **QMD collection names are restricted:** raw paths cannot be used directly as collection names, so the extension must derive a path-based encoded key.
- **`setActiveTools()` is shared mutable state:** v1 documents this limitation rather than trying to solve global tool-mode coordination.
