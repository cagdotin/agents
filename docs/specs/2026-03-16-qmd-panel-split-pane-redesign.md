# QMD Panel Split-Pane Redesign

Status: draft
Date: 2026-03-16
Track: agent-memory
Prior art: `docs/specs/2026-03-13-qmd-tui-panel.md`, `docs/specs/2026-03-16-qmd-multi-collection-selector.md`
Search exploration: `.pi/tracks/agent-memory/workstreams/qmd-tui-search.md`
Inspiration: [LazyQMD](https://github.com/AlexZeitler/lazyqmd) — [blog post](https://alexanderzeitler.com/articles/introducing-lazyqmd-a-tui-for-qmd/)

## 1. Problem Statement

The current QMD panel uses a sequential drill-in model: overview → collections → files → back. Collections are hidden behind a `c` keypress — you have to know they exist. Switching between collections, file browsing, and (future) search requires navigating back and forth through views. There's no persistent orientation — you lose the "where am I" feeling when switching views.

LazyQMD demonstrates that a persistent sidebar + main content pane layout is more natural for collection-based browsing. It also ships interactive search with mode cycling — a feature our panel exploration documented but never implemented.

### Desired end state

- A split-pane layout: persistent collection sidebar (left) + context-sensitive main pane (right).
- `tab` to switch focus between sidebar and main pane. Focused pane gets accent borders.
- Collection navigation is always one `j/k` away — no drill-in required.
- Main pane supports three views: overview (existing), files (existing), search (new).
- Interactive search with debounced lex (instant) and full hybrid (on enter).
- Search mode cycling with `ctrl+t`: lex → hybrid → query.
- Footer changes with context — shows shortcuts for the currently focused pane and view.

## 2. Design Principles

### Unix Philosophy (applied)

| Rule | Application |
|------|-------------|
| **Separation** | Layout engine (how panes combine line-by-line) is separate from view content (what each pane renders). Focus management is separate from both. |
| **Representation** | Focus state, sidebar selection, main pane view — all folded into data fields. Render logic reads fields and draws. No conditionals about "which mode are we in" scattered across methods. |
| **Modularity** | Sidebar rendering, main pane rendering, and footer rendering are independent units that compose at the frame level. |
| **Least Surprise** | Same keys as before: `j/k` navigate, `enter` acts, `esc` backs out, `q` closes. `tab` for focus switching matches LazyQMD and general TUI convention. `/` for search/filter matches vim. |
| **Simplicity** | Three main pane views, not five. No document previewer, no editor integration, no HTML preview. Those are different tools (Rule of Parsimony). |
| **Extensibility** | Adding a fourth main pane view (e.g., document preview) requires: one new render method, one new input handler, one new entry in the view switch — no layout changes. |

### Deep Modules (applied)

The public interface stays unchanged: `show_qmd_panel(ctx, callbacks, snapshot)`. The entire split-pane layout, focus model, sidebar state, and search pipeline are hidden behind this single call. Each view within the main pane is a self-contained rendering unit — the panel doesn't need to understand what a view draws, only how much space it gets.

### Aesthetic Direction

**Tone: Industrial-utilitarian** (continued from original panel spec). Dense information, clean box-drawing, monospace grid discipline. The sidebar is a persistent anchor. Focused pane border uses `accent`; unfocused uses `dim`. The visual hierarchy makes focus obvious at a glance.

## 3. Layout

```
╭─ Collections ────────┬─ agents ───────────────────────────────────╮
│                       │                                            │
│  ▸ All (4)            │  ◈ agents                                  │
│    agents       ● 142 │  ┌────────────────────────────────────┐    │
│    blog           38  │  │ agents (bound) · **/*.md · 142 docs │    │
│    notes          21  │  │ fresh ✓ · indexed 2h ago · a3f91d2  │    │
│    dotfiles        7  │  └────────────────────────────────────┘    │
│                       │                                            │
│                       │  ── Index ────────────────────────────────  │
│                       │      documents     142                     │
│                       │      vector index  ✓                       │
│                       │      needs embed   0                       │
│                       │      collections   4                       │
│                       │                                            │
│                       │  ── Contexts (2) ─────────────────────────  │
│                       │    docs/          Project documentation     │
│                       │    extensions/    Pi extension source       │
│                       │                                            │
│  /blog█              │                                            │
│                       │                                            │
├───────────────────────┴────────────────────────────────────────────┤
│  tab switch · / filter · j/k nav · enter select     agents · 2/4  │
╰────────────────────────────────────────────────────────────────────╯
```

### Structural properties

- **Single overlay** — rendered as one `render(width): string[]`. Sidebar and main columns are merged line-by-line in the frame method.
- **Width**: `"90%"` with `minWidth: 90`, `maxHeight: "80%"`. Up from current fixed `80`.
- **Sidebar**: Fixed width (~26 chars inner). Always visible. Replaces the separate "collections" view entirely.
- **Main pane**: Fills remaining width. Content varies by active main view.
- **Separator**: Single `│` between panes, colored by focus state (accent when receiving focus indicator, dim otherwise).
- **Footer**: Full width, below both panes. Context-sensitive.

### Responsive behavior

If terminal width < 90, the panel still renders but sidebar shrinks. Collection names truncate. Below ~70, consider collapsing to single-pane (sidebar only or main only), but this is a stretch goal.

## 4. Focus Model

Two focusable panes: `"sidebar"` and `"main"`.

| Key | Action |
|-----|--------|
| `tab` | Toggle focus between sidebar and main pane |
| `esc` | Context-dependent: clear sidebar filter → back from sub-view → close panel |
| `q` | Close panel from any state |
| `ctrl+c` | Close panel from any state |
| `ctrl+alt+q` | Toggle panel from any state |

### Visual feedback

- Focused pane: border label in `accent` color, separator on focused side in `accent`
- Unfocused pane: border label in `dim` color
- Footer shows shortcuts relevant to the currently focused pane

### Esc cascade

`esc` resolves the most local state first:

1. If sidebar filter is active → clear filter
2. If main pane is in search with input focused → blur input (focus results)
3. If main pane is in files or search view → back to overview
4. Otherwise → close panel

## 5. Sidebar (Always Visible)

### Content

```
 Collections ─────────
  ▸ All (4)            ← synthetic "All" entry, total doc count
    agents       ● 142 ← ● = bound collection marker
    blog           38  ← doc count right-aligned
    notes          21
    dotfiles        7

 /blog█                ← filter input (only when filter is active)
```

### Behavior

- **`j/k` or `↑↓`**: Navigate collection cursor
- **`enter`**: Select collection → main pane refreshes with that collection's overview
- **`/`**: Enter filter mode (existing filter logic, relocated from collections view)
- **`u`**: Re-index selected collection (bound) or all (from "All")
- **`e`**: Create embeddings for selected collection
- **`i`**: Start init flow (if repo not indexed)

### Synthetic "All" entry

The first entry is always `All (N)` where N is the total collection count. Selecting "All" sets `selected_collection_key` to `null`, which means:
- Overview shows global index health
- Search scopes to all collections
- Files view is unavailable (no single collection to browse)

### Bound collection marker

The collection that matches the current repo's QMD binding shows a `●` marker. This replaces the `[bound]` tag from the current collections view.

## 6. Main Pane Views

The main pane shows one of three views, switched by keybindings when the main pane is focused:

| Key (main focused) | View | Description |
|---------------------|------|-------------|
| (default) | **Overview** | Collection details, index stats, contexts, stale files |
| `f` or `enter` | **Files** | NERDTree file tree with index toggle |
| `s` or `/` | **Search** | Query input + results |

`esc` from files or search returns to overview.

### 6a. Overview (existing, adapted)

Same content as current overview: collection info card, index section, contexts section, stale section. Rendered into the main pane column instead of full width. Scrollable with `j/k` when content overflows.

### 6b. Files (existing, relocated)

Same NERDTree file tree, same toggle indicators (`●○◉◎`), same batch apply with `a`. Just rendered in the right pane instead of full-panel. The header strip shows `Files` breadcrumb. Available only when a specific collection is selected (not "All").

### 6c. Search (new)

```
─ Search: agents ─── lex ──────────────────
  > how does extension work█
  ─────────────────────────────────────────
  3 results · lex · 4ms

  ▸ docs/resources/deep-modules…     0.88
    Your Codebase Is Probably Not…
    …AI doesn't carry a mental model…

    extensions/damage-control/…      0.53
    Damage Control Extension
    …intercepts tool calls before…

    docs/specs/tracks-lifecycle…     0.44
    Tracks Extension Lifecycle
    …task discipline system for…
```

#### Search behavior

- **Debounced `searchLex` on keystroke** (~200ms debounce) for instant keyword feedback
- **`enter` in input** triggers full hybrid search (`hybridQuery`) with loading indicator
- **`ctrl+t`** cycles search mode: `lex` → `hybrid` (affects what `enter` triggers)
- **`tab`** toggles focus between search input and results list
- **`j/k`** navigates results (when results focused)
- **`enter` on a result** → copies file path to clipboard (via `pbcopy` on macOS)
- **`y`** on a result → copies file path to clipboard (vim yank)
- **Always scoped to the selected collection.** Search is unavailable when "All" is selected — `s`/`/` does nothing. Global search is a future enhancement.

#### Search result shape

Each result occupies 3-4 lines:

```
  ▸ path/to/file.md                  0.88   ← cursor marker, path, score
    Document Title                           ← title from QMD
    …snippet excerpt with context…           ← 1-2 lines of snippet
                                             ← blank separator
```

#### SDK integration

Two new wrappers in `qmd-store.ts`:

```typescript
search_lex(query: string, collection?: string): SearchResult[]
search_hybrid(query: string, collection?: string): Promise<HybridQueryResult[]>
```

These use the existing `with_store()` pattern:
- `search_lex` → `store.searchFTS(query, limit, collection)`
- `search_hybrid` → `hybridQuery(store, query, { collection, limit })`

## 7. Footer

Full-width bar below both panes. Content depends on focused pane + current main view.

### Footer by context

| Focused Pane | Main View | Footer Left | Footer Right |
|---|---|---|---|
| Sidebar | any | `tab switch · / filter · j/k nav · enter select · u update · e embed` | `collection · pos` |
| Main | Overview | `tab switch · f files · s search · u update · r refresh` | `collection` |
| Main | Files | `tab switch · space toggle · a apply · enter expand · esc back` | `collection · pos` |
| Main | Search (input) | `tab results · ctrl+t mode · enter search · esc back` | `mode · collection` |
| Main | Search (results) | `tab input · j/k nav · enter copy · y yank · esc back` | `mode · pos` |

## 8. What We Skip

| Feature | Why |
|---------|-----|
| Document preview | Complex rendering, low ROI in agent context — agent reads files directly via tools |
| $EDITOR integration | Not meaningful for an embedded overlay in a coding agent |
| HTML live preview | Not applicable to our use case |
| Add/delete/rename collections | Useful but secondary. Can add later as sidebar shortcuts. |
| Collection reindex progress | Current `updating` view is sufficient; no need to redesign |

## 9. Architecture

### Eliminated

The separate `"collections"` PanelView — fully replaced by the always-visible sidebar.

### Modified files

| File | Change |
|------|--------|
| `ui/panel.ts` | Major rewrite: split-pane renderer, focus model, sidebar rendering, search view, frame composition |
| `ui/data.ts` | Add `QmdSearchResult` type; minor snapshot adjustments |
| `ui/constants.ts` | New/updated: `QMD_PANEL_WIDTH` → `"90%"`, add `QMD_SIDEBAR_WIDTH`, remove old width constant |
| `core/qmd-store.ts` | Add `search_lex()` and `search_hybrid()` wrappers |
| `extension/command.ts` | Add `on_search_lex` and `on_search_hybrid` callbacks to `QmdPanelCallbacks` |
| `docs/panel.md` | Rewrite to document new layout, focus model, keyboard shortcuts |

### Preserved

All existing functionality: overview content, file tree with toggle, freshness tracking, update action, init flow, plain-text fallback. The `show_qmd_panel()` interface signature stays the same (callbacks grow, but that's additive).

### New panel state (sketch)

```typescript
// Focus
private focused_pane: "sidebar" | "main" = "sidebar";

// Sidebar state (replaces collections view state)
private sidebar_cursor = 0;
private sidebar_scroll_offset = 0;
private sidebar_filter_query = "";
private sidebar_filter_editing = false;

// Main pane state
private main_view: "overview" | "files" | "search" = "overview";

// Search state (new — see qmd-tui-search.md exploration)
private search_query = "";
private search_results: QmdSearchResult[] = [];
private search_loading = false;
private search_cursor = 0;
private search_scroll_offset = 0;
private search_mode: "lex" | "hybrid" = "lex";
private search_focus: "input" | "results" = "input";
private search_debounce_timer: Timer | null = null;
```

### Frame composition

The `render(width)` method:

1. Compute sidebar width (fixed) and main width (remaining)
2. Render sidebar lines: `render_sidebar(sidebar_width): string[]`
3. Render main pane lines: `render_main_pane(main_width): string[]`
4. Render footer lines: `render_footer(full_width): string[]`
5. Merge sidebar + separator + main line-by-line, pad shorter column
6. Wrap in outer frame (`╭─┬─╮` top, `├─┴─┤` before footer, `╰──╯` bottom)

This keeps each rendering unit independent and testable.

## 10. Callbacks Interface

```typescript
export interface QmdPanelCallbacks {
  get_snapshot: (selected_collection_key?: string) => Promise<QmdPanelSnapshot>;
  on_update: () => Promise<void>;
  on_init: () => void;
  on_close: () => void;
  on_toggle_files: (adds: string[], removes: string[]) => Promise<void>;
  on_embed: () => Promise<void>;                                    // NEW
  on_search_lex: (query: string, collection: string) => Promise<QmdSearchResult[]>;      // NEW
  on_search_hybrid: (query: string, collection: string) => Promise<QmdSearchResult[]>;   // NEW
}
```

## 11. Resolved Questions

- **`enter` on search result**: **Copy path to clipboard** (`pbcopy` on macOS). `y` also copies (vim yank convention). Inserting into chat would require Pi API access the panel doesn't have; document preview is deferred. Can revisit with a callback later.
- **Search debounce timing**: **200ms for v1**. Validate during milestone 6 against real indexes — tune to 300-400ms if partial results flood or lag is noticeable.
- **Search scope**: **Always scoped to the selected collection.** When "All" is selected in the sidebar, search is unavailable (pressing `s`/`/` does nothing). Global cross-collection search is a future enhancement — discuss the UX separately before adding it.
- **Responsive sidebar collapse**: **Deferred.** `minWidth: 90` prevents rendering at unusably narrow widths. Proper responsive collapse adds focus-model complexity. Ship the split-pane first.
