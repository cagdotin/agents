# Exploration: QMD TUI Search

Status: exploration complete → incorporated into panel split-pane redesign (milestones 5-7)
Spec: `docs/specs/2026-03-16-qmd-panel-split-pane-redesign.md` (Section 6c)
Plan: `docs/exec-plans/active/2026-03-16-qmd-panel-split-pane-redesign.md` (Milestones 5, 6, 7)

## Goal

Add interactive search/query capability to the QMD TUI panel — type a query, see results inline, scoped to the selected collection via the sidebar.

## Context gathered (still valid)

### SDK search methods

| Method | Speed | Quality | LLM needed? |
|--------|-------|---------|-------------|
| `store.searchFTS(query)` | ~instant | keyword-match only (BM25) | No |
| `hybridQuery(store, query)` | 2-8 sec | full hybrid (expand + vector + rerank) | Yes (local) |

### Search result shapes (from SDK)

**`SearchResult`** (from `searchFTS`):
- `score`, `source` (`"fts"` / `"vec"`), `chunkPos?`
- Extends `DocumentResult`: file, title, body, etc.

**`HybridQueryResult`** (from `hybridQuery`):
- `file` — virtual path (`qmd://agents/docs/foo.md`)
- `displayPath`, `title`, `body`
- `bestChunk`, `bestChunkPos`
- `score` — relevance (0-1)
- `context` — collection context annotation (nullable)
- `docid` — short hash (`#42d15d`)

## Resolved decisions

All open questions from the exploration phase were resolved in the spec:

| Question | Resolution |
|----------|------------|
| Key binding for search entry | `s` or `/` from main pane (no conflict — sidebar owns `/` for filter, main pane owns it for search) |
| `enter` on a result | Copy path to clipboard (`y` also copies) |
| Search scope | Follows sidebar selection — "All" searches globally, specific collection scopes |
| Snippet rendering | Parse `@@ line` format, strip headers, trim to 2 lines, prefix with `…` |
| Debounce strategy | Debounced lex on keystroke (~200ms), `enter` triggers active mode (lex or hybrid) |
| Virtual path stripping | Strip `qmd://collection/` prefix, show relative path |
| Search modes | `ctrl+t` cycles: lex → hybrid (matches LazyQMD's mode cycling pattern) |
| Search focus model | `tab` toggles between input and results list within search view |

## Implementation (from exec plan)

**Milestone 5** — SDK wrappers: `search_lex()` and `search_hybrid()` in `qmd-store.ts`, `QmdSearchResult` type in `data.ts`, callbacks in `QmdPanelCallbacks`.

**Milestone 6** — Search UI: input with debounced lex, results rendering, `tab` focus switching between input and results, `esc` cascade.

**Milestone 7** — Hybrid mode: `ctrl+t` mode cycling, hybrid search with loading indicator, snippet formatting polish, score display as percentages.

See the exec plan for full details, validation criteria, and file-by-file work items.
