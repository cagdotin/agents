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
- ✅ **RETIRED 2026-04-04** — extension moved to `.graveyard/`, expertise YAML + specs archived
- Direction: vault-based memory with atomic notes, MOC routing, agent-driven retrieval

## Current tasks

- [x] **QMD panel split-pane redesign** (8 milestones) — complete
- [ ] Implement tracks milestone 2 from `docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- [ ] ~~Define v1 design sketch for unified tracks+expert memory plugin~~ → superseded by vault-based memory direction
- [ ] Design vault-based agent memory: per-repo vault structure, MOC for domain expertise, atomic claim notes
- [ ] Prototype vault integration: agent reads/writes atomic notes, navigates via MOC, retrieves via QMD
- [ ] Define what "domain expertise" looks like as a vault MOC (folder structure, note templates, linking conventions)
- [ ] Validate which OpenViking ideas to adopt next (tiering/promotion/retrieval orchestration) within vault model

## Upstream

- [ ] Create PR to QMD repo: add opt-in `dot` option to `reindexCollection` (e.g. `{ dot?: boolean }`) so dot-path files can be included in the scanner without needing our `extra_paths` workaround. Must not change default behavior (`dot: false`).

## Open threads

- What vault folder structure maps best to agent memory needs? (per-repo `.vault/` or shared vault with repo namespaces?)
- How does the vault MOC pattern from `0xcgn/vault` translate to agent-authored notes?
- Should notes be plain markdown (Obsidian-compatible) or need structured frontmatter for agent parsing?
- How does QMD index vault notes? Does it replace or complement vault-internal linking?
- Which information belongs in tracks vs vault to avoid duplication?
- Should promotion be manual-only in v1, with optional assisted suggestions later?

## Next steps

- Study `0xcgn/vault` methodology and extract the patterns that apply to agent memory
- Design the vault folder structure and note templates for domain expertise
- Prototype: agent creates/reads atomic claim notes during a real task, measures retrieval quality vs old YAML approach
- Define the L2 boundary: what lives in vault notes vs what stays in track files

## Done

- QMD extension v1 + TUI panel shipped and validated.
- **QMD panel split-pane redesign shipped.** Persistent sidebar, 3 main views (overview/files/search), 3 search modes (hybrid/lex/vector), arrow-key pane navigation, init prompt for non-indexed repos. All 8 milestones complete.
- Expert extension simplification shipped and validated.
- Tracks minimal extension shipped and validated.
- Former `track-extension` and `expert-extension-rework` tracks consolidated into this track's `workstreams/` folder.
