# Tasks

## Current phase

Consolidated memory architecture planning (post-implementation):
- QMD stream shipped
- expert simplification shipped
- tracks lifecycle milestone 2 pending
- next target: unified tracks+expert direction inspired by OpenViking layering

## Stream status

### QMD stream
- ✅ v1 extension implemented
- ✅ TUI panel implemented
- ✅ File tree toggle (select/unselect files for index inclusion)
- ✅ Dot-path file indexing with persistence across updates
- ✅ **Panel split-pane redesign — shipped**
  - Split-pane layout: persistent sidebar (left) + main pane (right)
  - Interactive search with 3 modes: hybrid, lex, vector
  - Arrow key / vim navigation between panes
  - Init prompt for non-indexed repos
  - All 8 milestones complete
- ⏳ pending upstream release with PR #377 + #385

### Tracks stream (merged from `track-extension`)
- ✅ minimal tracks extension implemented
- ✅ session-trace authority fix validated
- ⏳ milestone 2 lifecycle/status improvements still open

### Expert stream (merged from `expert-extension-rework`)
- ✅ simplification implemented
- ✅ append-first expertise updates in place
- ⏳ future pruning strategy for append-only domains

## Current tasks

- [x] **QMD panel split-pane redesign** (8 milestones) — complete
- [ ] Implement tracks milestone 2 from `docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- [ ] Define v1 design sketch for unified tracks+expert memory plugin (workstream memory + domain memory boundary)
- [ ] Decide promotion flow: session findings → track files → expertise append
- [ ] Validate which OpenViking ideas to adopt next (tiering/promotion/retrieval orchestration) without adopting its runtime stack

## Upstream

- [ ] Create PR to QMD repo: add opt-in `dot` option to `reindexCollection` (e.g. `{ dot?: boolean }`) so dot-path files can be included in the scanner without needing our `extra_paths` workaround. Must not change default behavior (`dot: false`).

## Open threads

- Should unified memory live as one extension with internal modules, or two extensions sharing one explicit contract?
- Which information belongs in tracks vs expertise to avoid duplication?
- Should promotion be manual-only in v1 of unification, with optional assisted suggestions later?
- How should compaction/pruning work for long-lived expertise files while preserving important history?

## Next steps

- Use `workstreams/tracks-extension.md` and `workstreams/expert-extension-rework.md` as consolidation baselines.
- Draft a short unification spec that defines responsibilities for L1 (workstream) vs L2 (domain) memory.
- Run one end-to-end workflow example (new initiative → track execution → expertise promotion → QMD lookup) and capture friction.

## Done

- QMD extension v1 + TUI panel shipped and validated.
- **QMD panel split-pane redesign shipped.** Persistent sidebar, 3 main views (overview/files/search), 3 search modes (hybrid/lex/vector), arrow-key pane navigation, init prompt for non-indexed repos. All 8 milestones complete.
- Expert extension simplification shipped and validated.
- Tracks minimal extension shipped and validated.
- Former `track-extension` and `expert-extension-rework` tracks consolidated into this track's `workstreams/` folder.
