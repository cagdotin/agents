# Tasks

## Current focus

Add a TUI panel to the QMD extension — an interactive dashboard showing index status, freshness, contexts, stale files, and indexed file browser. Accessible via `/qmd`, `/qp`, and `Ctrl+Alt+Q`.

- Spec: `docs/specs/2026-03-13-qmd-tui-panel.md`
- Exec plan: `exec-plans/qmd-tui-panel.md`

## Current state

Completed already: QMD research and option comparison, local QMD install via fork with Bun fixes, initial `agents` collection setup and embedding, QMD skill installation, and the revised spec/execution-plan/design-doc pass.

Remaining active work lives below.

## Active rollout: QMD Pi Extension v1

See `exec-plans/qmd-extension-v1.md` for the full checklist.

### M1: Core + Contracts
- [x] Scaffold `core/`, `domain/`, `extension/`, `docs/`, `__tests__/`
- [x] Add `core/errors.ts`
- [x] Add `core/types.ts` with **Zod-first** schemas
- [x] Add `core/qmd-store.ts`
- [x] Verify SDK import from extension
- [x] Confirm path-derived collection key encoding

### M2: Repo Binding + Detection
- [x] Normalize repo root detection
- [x] Implement `.pi/qmd.json` marker read/write
- [x] Implement path-based binding detection
- [x] Add marker/SDK mismatch handling

### M3: Runtime Wiring + Silent Footer
- [x] Wire `session_start` binding + freshness checks
- [x] Add `before_agent_start` QMD prompt injection
- [x] Keep non-indexed repos silent
- [x] Add `session_shutdown` store cleanup

### M4: Status + Scoped Update Command
- [x] Implement `/qmd status`
- [x] Implement `/qmd update` for current repo only
- [x] Refresh marker freshness after update

### M5: Freshness Detection
- [x] Add git-based markdown freshness detection
- [x] Return `fresh | stale | unknown`
- [x] Surface freshness in footer/status

### M6: Deterministic Onboarding Pipeline
- [x] Add bounded repo scan
- [x] Add deterministic draft proposal
- [x] Add prompt builder for LLM refinement
- [x] Add Zod normalization of confirmed proposal
- [x] Execute init via SDK

### M7: Workflow Tool + Init UX Hardening
- [x] Register `qmd_init` inactive by default
- [x] Activate it only during `/qmd init`
- [x] Parse tool input through Zod after Pi boundary validation
- [x] Always deactivate in `finally`
- [x] Document shared `setActiveTools()` caveat

### M8: Documentation + Quality Pass
- [x] Add `README.md`
- [x] Add `docs/architecture.md`
- [x] Add `docs/onboarding.md`
- [x] Add `docs/freshness.md`
- [x] Align track docs with implementation learnings

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
