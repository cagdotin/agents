# Tasks

## Phase 1: Research & Evaluation ✅
- [x] Survey agent memory landscape (Fireship video + deep dives)
- [x] Deep dive QMD architecture, search pipeline, SDK
- [x] Deep dive OpenViking architecture, tiering, memory extraction
- [x] Compare QMD vs OpenViking vs our current system
- [x] Decide on integration approach

## Phase 2: QMD Integration
### Layer 1: Global install + CLI ✅
- [x] Install QMD globally (`npm install -g @tobilu/qmd`)
- [x] Add `agents` project as first collection (92 files, 263 chunks)
- [x] Set up context annotations (7 annotations across subcollections)
- [x] Generate embeddings (11s, 263 chunks)
- [x] Install QMD skill globally (`~/.agents/skills/qmd/SKILL.md`)
- [x] Test search quality — validated with 3 queries, results are relevant and well-ranked
- [ ] Add more projects as needed (user-driven, manual)

### Layer 2: Pi extension (next)
- [ ] Build `qmd` extension — auto-detect project, default collection filter
- [ ] `/qmd` command for quick search, `/qmd cross` for cross-project
- [ ] `session_start` hook: update if stale, surface relevant results
- [ ] `session_end` hook: re-index if `.pi/` files changed

### Layer 3: Expertise ↔ QMD hybrid (future)
- [ ] Thin out expertise domains to navigational pointers (L0/L1)
- [ ] QMD becomes the deep retrieval layer (L2)
- [ ] Design auto memory extraction from session findings → expertise append
- [ ] Session compression improvements for tracks

## Architecture Decisions
- **One global index, collections per project** — single `~/.cache/qmd/index.sqlite`
- **Collection filtering for focus** — `-c agents` when in agents, drop filter for cross-project
- **Context annotations for labeling** — each collection + key subdirs get descriptions
- **Projects added manually** — user controls which projects are indexed
- **Three integration layers** — CLI skill → pi extension → expertise hybrid

## Pending Upstream
- [ ] **QMD Bun fix:** Watch for a new QMD release (>2.0.1) that merges PRs [#377](https://github.com/tobi/qmd/pull/377) and [#385](https://github.com/tobi/qmd/pull/385). Once shipped: reinstall with `bun install -g @tobilu/qmd`, remove `BUN_INSTALL=""` workaround from skill doc and all usage notes. Check: `npm info @tobilu/qmd version`

## Known Issues
- **Bun incompatibility (v2.0.1):** `bun:sqlite` replaces `better-sqlite3` and uses Apple's system SQLite which has `SQLITE_OMIT_LOAD_EXTENSION` — sqlite-vec can't load. Launcher also falsely routes to Bun when `$BUN_INSTALL` is set. Workaround: `BUN_INSTALL="" qmd ...`. Fix PRs: [#377](https://github.com/tobi/qmd/pull/377) (Homebrew SQLite via `setCustomSQLite()`), [#385](https://github.com/tobi/qmd/pull/385) (launcher lockfile priority).
