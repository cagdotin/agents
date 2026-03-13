# Tasks

## Current state

All planned QMD extension work is complete — both the v1 extension and the TUI panel.

## Completed: QMD Pi Extension v1 ✅

See `exec-plans/qmd-extension-v1.md` for the full checklist. All 8 milestones done.

## Completed: QMD TUI Panel ✅

See `exec-plans/qmd-tui-panel.md` for the full checklist. All 8 milestones done.

- Spec: `docs/specs/2026-03-13-qmd-tui-panel.md`
- Interactive dashboard accessible via `/qmd`, `/qp`, and `Ctrl+Alt+Q`
- Overview view: binding status, freshness, index stats, contexts, stale files
- Files view: NERDTree-style collapsible file browser with vi-style navigation
- Updating view: in-panel update with progress
- Plain-text fallback for non-TUI environments
- Full keyboard shortcuts (scroll, navigate, toggle, update, init)
- Tests covering snapshot builder, file tree, formatting helpers
- Documented in `extensions/qmd/docs/panel.md` and README

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
