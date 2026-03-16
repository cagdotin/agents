# QMD Panel Split-Pane Redesign — Execution Plan

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

Conforms to the planning standard in `skills/plan/PLAN.md`.

## Purpose / Big picture

Redesign the QMD TUI panel from a sequential drill-in model (overview → collections → files) into a persistent split-pane layout (sidebar + main pane) with interactive search. After completion:

1. Opening `/qmd` shows a two-column panel: collections sidebar (left) + content pane (right).
2. `tab` switches focus between sidebar and main pane. The focused pane has accent-colored borders.
3. Collections are always visible and navigable — no drill-in required.
4. The main pane supports three views: overview, files, and search.
5. Search provides debounced keyword results on keystroke and full hybrid search on `enter`.
6. All existing functionality (file tree, index toggle, freshness, update, init) is preserved.

**Spec:** `docs/specs/2026-03-16-qmd-panel-split-pane-redesign.md`
**Implementation spec:** `docs/specs/2026-03-16-qmd-panel-split-pane-implementation.md`
**Search exploration:** `.pi/tracks/agent-memory/workstreams/qmd-tui-search.md`
**Existing panel spec:** `docs/specs/2026-03-13-qmd-tui-panel.md`

## Progress

- [x] Milestone 1: Split-pane frame and sidebar rendering
- [x] Milestone 2: Focus model and input routing
- [x] Milestone 3: Overview in main pane
- [x] Milestone 4: Files view in main pane
- [x] Milestone 5: Search SDK wrappers
- [x] Milestone 6: Search view — input and lex results
- [x] Milestone 7: Search view — hybrid mode and polish
- [ ] Milestone 8: Footer, docs, and cleanup

## Surprises & Discoveries

(None yet — update as work proceeds.)

## Decision Log

- **Decision:** Break into 8 milestones, each independently verifiable.
  Rationale: The panel.ts rewrite is ~700 lines. Doing it in one pass risks regressions. Each milestone produces a working (if incomplete) panel that can be tested.
  Date: 2026-03-16

- **Decision:** Sidebar replaces the collections view entirely. No dual mode.
  Rationale: The sidebar IS the collections view, always visible. Keeping both would violate Rule of Simplicity.
  Date: 2026-03-16

- **Decision:** Search callbacks are sync for lex, async for hybrid.
  Rationale: `searchFTS` is synchronous in the QMD SDK. `hybridQuery` is async (LLM calls). The callback types should reflect this to avoid unnecessary async overhead on the instant-feedback path.
  Date: 2026-03-16

- **Decision:** Search is always scoped to the selected collection. No global search in v1.
  Rationale: "All" in the sidebar is a navigation concept, not a search scope. Global cross-collection search UX needs separate design discussion. When "All" is selected, `s`/`/` does nothing.
  Date: 2026-03-16

- **Decision:** `enter` on a search result copies the file path to clipboard.
  Rationale: Inserting into chat requires Pi API access the panel doesn't have (only callbacks). Document preview is deferred. Clipboard copy is instant and zero-complexity.
  Date: 2026-03-16

- **Decision:** Responsive sidebar collapse deferred.
  Rationale: `minWidth: 90` prevents unusably narrow panels. Proper collapse adds focus-model complexity. Ship split-pane first.
  Date: 2026-03-16

## Outcomes & Retrospective

(Fill in after completion.)

---

## Context and Orientation

### Current state

The QMD panel lives in `extensions/qmd/ui/panel.ts` (~680 lines). It's a single `QmdPanel` class that implements `{ render, handleInput, invalidate }` and is shown as a centered overlay via `show_qmd_panel()` in `extensions/qmd/ui/panel.ts`.

Key files:

| File | Role |
|------|------|
| `extensions/qmd/ui/panel.ts` | Panel class: views (overview, collections, files, updating), rendering, input handling |
| `extensions/qmd/ui/data.ts` | `QmdPanelSnapshot` type, `build_qmd_panel_snapshot()`, file tree utilities |
| `extensions/qmd/ui/constants.ts` | Panel width (80), shortcuts, icon |
| `extensions/qmd/ui/toggle-state.ts` | Tracks pending file index changes |
| `extensions/qmd/ui/plain-text.ts` | Non-TUI fallback |
| `extensions/qmd/extension/command.ts` | Registers `/qmd` command, creates callbacks, calls `show_qmd_panel()` |
| `extensions/qmd/core/qmd-store.ts` | QMD SDK wrapper with `with_store()` pattern. No search wrappers yet. |
| `extensions/qmd/docs/panel.md` | Panel documentation |

### Target state

Same file structure, but:
- `panel.ts` — rewritten with split-pane renderer, sidebar, focus model, search view
- `data.ts` — adds `QmdSearchResult` type
- `constants.ts` — wider panel, sidebar width constant
- `qmd-store.ts` — adds `search_lex()` and `search_hybrid()`
- `command.ts` — adds search and embed callbacks
- `docs/panel.md` — rewritten

### Pi TUI API constraints

The overlay is a single component returning `string[]` from `render(width)`. Two-pane layout must be composed manually: render left column lines, render right column lines, merge them with a separator character per line. The `overlayOptions` support percentage widths (`"90%"`), `minWidth`, and `maxHeight`.

---

## Milestone 1: Split-Pane Frame and Sidebar Rendering

### Goal

Replace the current single-column frame with a two-column frame. The left column renders the collection sidebar. The right column renders a placeholder ("select a collection" or similar). The panel opens, shows the split layout, and closes with `q`/`esc`. No input handling beyond close — just the visual frame.

### Why first

The frame composition is the structural foundation. Every subsequent milestone renders content into this frame. Getting it right first means all later work is additive.

### Work

1. **`constants.ts`** — Change `QMD_PANEL_WIDTH` to `"90%"` (string for percentage). Add:
   ```typescript
   export const QMD_SIDEBAR_INNER_WIDTH = 24;
   export const QMD_PANEL_MIN_WIDTH = 90;
   ```

2. **`command.ts`** — Update `overlayOptions` in `show_qmd_panel()` call:
   ```typescript
   overlayOptions: {
     anchor: "center",
     width: "90%",
     minWidth: QMD_PANEL_MIN_WIDTH,
     maxHeight: "80%",
   }
   ```

3. **`panel.ts`** — New frame composition method:
   - Add `focused_pane: "sidebar" | "main"` state field (default `"sidebar"`)
   - Add `render_sidebar(inner_width, height): string[]` — renders collection list with cursor, filter area, padding
   - Add `render_main_placeholder(inner_width, height): string[]` — temporary: just the collection name or "Overview" text
   - Modify `render(width)`:
     1. Compute `sidebar_w = QMD_SIDEBAR_INNER_WIDTH`, `main_w = width - sidebar_w - 3` (outer borders + separator)
     2. Compute available body height (max_height minus top border, footer, bottom border)
     3. Call `render_sidebar(sidebar_w, body_h)` and `render_main_placeholder(main_w, body_h)`
     4. Merge line-by-line: `│` + sidebar_line + `│` + main_line + `│`
     5. Top border: `╭─ Collections ─┬─ {name} ─╮` with focus-colored labels
     6. Footer separator: `├──┴──┤`
     7. Footer content
     8. Bottom border: `╰──╯`

4. **Sidebar content** — Render from `this.snapshot.collections`:
   - First entry: `All ({total_count})` synthetic
   - Each collection: `{name}  {● if bound} {doc_count}`
   - Cursor marker: `▸` on selected row
   - Filter area at bottom (empty for now)

### Validation

- Run `bun run check` — no type errors
- Open `/qmd` in Pi — panel shows two-column layout
- Left column shows collection list with "All" + real collections
- Right column shows placeholder content
- `q` or `esc` closes the panel
- Sidebar and main have different border label colors (both dim for now — focus comes in M2)

### Files touched

- `extensions/qmd/ui/constants.ts` (modify)
- `extensions/qmd/ui/panel.ts` (major modify — add frame composition, sidebar rendering)
- `extensions/qmd/extension/command.ts` (modify overlayOptions)

---

## Milestone 2: Focus Model and Input Routing

### Goal

`tab` switches focus between sidebar and main pane. Visual feedback shows which pane is focused (accent vs dim borders). Input is routed to the focused pane's handler. Sidebar `j/k` navigation and collection selection work.

### Work

1. **`panel.ts`** — Input routing:
   - `handleInput()` checks `focused_pane` and routes to `handle_sidebar_input()` or `handle_main_input()`
   - Global keys handled before routing: `tab` (toggle focus), `q`/`ctrl+c`/`ctrl+alt+q` (close)
   - `handle_sidebar_input()`:
     - `j/k/↑↓` — move sidebar cursor
     - `enter` — select collection → call `get_snapshot(key)` → refresh, switch to main overview
     - `/` — enter filter mode
     - `g/G`, `pageUp/pageDown` — jump navigation
     - Filter typing mode (reuse existing collection filter logic)
   - `handle_main_input()` — for now, just `esc` to switch back to sidebar (overview placeholder has no interaction yet)

2. **Visual focus feedback** — In `render()`:
   - Top border: `╭─ Collections ─┬─ {name} ─╮`
     - "Collections" label: `accent` when sidebar focused, `dim` when not
     - Collection name label: `accent` when main focused, `dim` when not
   - Separator `│` between panes: `borderAccent` on focused side, `borderMuted` on other

3. **Sidebar state** — Migrate from collections view state:
   - `sidebar_cursor`, `sidebar_scroll_offset`, `sidebar_filter_query`, `sidebar_filter_editing`
   - `selected_collection_key` — already exists, reuse
   - New synthetic "All" entry at index 0

4. **Collection selection** — When `enter` is pressed on a sidebar entry:
   - If "All" → set `selected_collection_key = null`
   - If specific collection → set `selected_collection_key = key`
   - Refresh snapshot via `callbacks.get_snapshot(key)`
   - Reset main view to `"overview"`

### Validation

- `tab` toggles visual focus between panes (border colors change)
- `j/k` moves through collections in sidebar
- `enter` on a collection updates the main pane header with the collection name
- `/` enters filter mode, typing filters collections, `esc` clears filter
- Footer shows sidebar-appropriate shortcuts when sidebar is focused
- All existing close shortcuts still work

### Files touched

- `extensions/qmd/ui/panel.ts` (modify — input routing, focus state, sidebar navigation)

---

## Milestone 3: Overview in Main Pane

### Goal

The main pane's default view renders the existing overview content: collection info card, index stats, contexts, stale files. Selecting a collection in the sidebar updates the overview. Scrollable with `j/k` when main is focused.

### Work

1. **`panel.ts`** — Extract and adapt existing overview rendering:
   - Move `render_selected_overview()` content into `render_main_overview(width, height): string[]`
   - Adapt all width calculations to use the main pane's inner width (not full panel width)
   - Render collection info card, index section, contexts, stale section — same data, narrower column
   - Overview scrolling: `j/k` when main is focused and `main_view === "overview"`

2. **Main pane rendering** — `render_main_pane(width, height)` dispatches:
   ```typescript
   if (this.main_view === "overview") return this.render_main_overview(width, height);
   if (this.main_view === "files") return this.render_main_files(width, height);
   if (this.main_view === "search") return this.render_main_search(width, height);
   ```

3. **"All" overview** — When `selected_collection_key` is null:
   - Show global index health (total docs across all collections, embedding status)
   - Show collection count
   - No freshness (freshness is per-binding)
   - No contexts (contexts are per-collection)

4. **Status badge** — Render in the main pane header area (top border label or first content line), same logic as existing `status_badge()`.

### Validation

- Open `/qmd` — sidebar shows collections, main shows overview for the default collection
- Click through collections with `j/k` + `enter` — main pane updates with correct stats
- Select "All" — main shows global health
- Select bound collection — main shows freshness, stale files, contexts
- `j/k` in main pane (after `tab`) scrolls overview content
- `u` from main overview triggers update (existing functionality preserved)

### Files touched

- `extensions/qmd/ui/panel.ts` (modify — extract overview rendering into main pane)

---

## Milestone 4: Files View in Main Pane

### Goal

Press `f` or `enter` when main pane is focused on overview → switches to file tree view. All existing file tree functionality (NERDTree browser, index toggle, batch apply) works in the main pane column.

### Work

1. **`panel.ts`** — Adapt file tree rendering:
   - Move existing `render_files_view()` content into `render_main_files(width, height): string[]`
   - Adapt width calculations for main pane inner width
   - File tree state fields (tree_roots, tree_collapsed, tree_flat, tree_cursor, etc.) remain on the panel class
   - `handle_main_input()` routes to `handle_main_files_input()` when `main_view === "files"`

2. **View switching**:
   - From overview: `f` or `enter` → `main_view = "files"`, build tree, render
   - From files: `esc` → `main_view = "overview"`, clear toggle state
   - Files view unavailable when "All" is selected (no single collection to browse) — `f` does nothing

3. **Existing interactions preserved**:
   - `j/k` — navigate tree
   - `enter`/`l`/`→` — expand/collapse dirs
   - `space` — toggle file/dir inclusion (bound only)
   - `a` — apply pending changes (bound only)
   - `h`/`←` — back to overview (same as `esc`)

4. **Header** — Main pane top border shows `Files` breadcrumb when in files view:
   - `─ agents › Files ─` instead of `─ agents ─`

### Validation

- `tab` to main pane, `f` opens file tree
- Tree renders correctly in narrower column
- `space` toggles, `a` applies — same as before
- `esc` returns to overview
- Selecting "All" in sidebar, then `f` — nothing happens (correct)
- Selecting a different collection in sidebar while in files view — resets to overview with new collection

### Files touched

- `extensions/qmd/ui/panel.ts` (modify — relocate files rendering)
- `extensions/qmd/ui/toggle-state.ts` (no changes expected — verify)

---

## Milestone 5: Search SDK Wrappers

### Goal

Add `search_lex()` and `search_hybrid()` to `qmd-store.ts`. Add the `QmdSearchResult` type to `data.ts`. Add search callbacks to `QmdPanelCallbacks` and wire them in `command.ts`. No UI yet — just the data layer.

### Work

1. **`core/qmd-store.ts`** — Add two new exported functions:
   ```typescript
   export function search_lex(query: string, collection?: string, limit?: number): SearchResult[] {
     // Note: searchFTS is synchronous in the SDK
     return with_store_sync("search (lex)", (store) => {
       return store.searchFTS(query, limit ?? 20, collection);
     });
   }

   export async function search_hybrid(
     query: string,
     collection?: string,
     limit?: number,
   ): Promise<HybridQueryResult[]> {
     return with_store("search (hybrid)", async (store) => {
       const { hybridQuery } = await import("@tobilu/qmd");
       return hybridQuery(store, query, { collection, limit: limit ?? 20 });
     });
   }
   ```
   Note: `searchFTS` is a method on the store object and is synchronous. Need to verify whether `with_store` can be used synchronously or if we need a sync variant.

   If `searchFTS` is sync but `with_store` is async (because `open_store` is async), we have two options:
   - Make `search_lex` async too (simpler, slight overhead on the instant-feedback path)
   - Add a `with_store_sync` that throws if store isn't ready yet (faster but more complex)

   Recommend: make `search_lex` async for v1. The store opens once and stays open — after first call the Promise resolves instantly.

2. **`ui/data.ts`** — Add search result type:
   ```typescript
   export interface QmdSearchResult {
     file: string;           // virtual path (qmd://collection/path.md)
     display_path: string;   // relative path for display
     title: string;
     score: number;
     snippet: string;        // extracted snippet text
     docid: string;
     source: "lex" | "hybrid";
   }
   ```
   Add helper to normalize SDK results into `QmdSearchResult`:
   ```typescript
   export function normalize_search_result(/* ... */): QmdSearchResult
   export function normalize_hybrid_result(/* ... */): QmdSearchResult
   ```

3. **`ui/panel.ts`** — Extend `QmdPanelCallbacks`:
   ```typescript
   on_search_lex: (query: string, collection?: string) => Promise<QmdSearchResult[]>;
   on_search_hybrid: (query: string, collection?: string) => Promise<QmdSearchResult[]>;
   on_embed: () => Promise<void>;
   ```

4. **`extension/command.ts`** — Wire callbacks:
   ```typescript
   on_search_lex: async (query, collection) => {
     // collection is always required — search is scoped to sidebar selection
     const raw = await search_lex(query, collection);
     return raw.map(r => normalize_search_result(r, collection));
   },
   on_search_hybrid: async (query, collection) => {
     const raw = await search_hybrid(query, collection);
     return raw.map(r => normalize_hybrid_result(r));
   },
   on_embed: async () => {
     await embed_pending();
     await refresh_runtime_state(ctx, state);
   },
   ```

### Validation

- `bun run check` passes — no type errors
- Write a quick manual test: call `search_lex("extension", "agents")` from a test script and verify results come back
- Existing panel still opens and works (no UI changes in this milestone)

### Files touched

- `extensions/qmd/core/qmd-store.ts` (modify — add search wrappers)
- `extensions/qmd/ui/data.ts` (modify — add QmdSearchResult, normalizers)
- `extensions/qmd/ui/panel.ts` (modify — extend QmdPanelCallbacks)
- `extensions/qmd/extension/command.ts` (modify — wire callbacks)

---

## Milestone 6: Search View — Input and Lex Results

### Goal

Press `s` or `/` when main pane is focused → opens search view. Typing a query triggers debounced lex search. Results render inline. `tab` toggles between input and results. `esc` returns to overview.

### Work

1. **`panel.ts`** — Add search state:
   ```typescript
   private search_query = "";
   private search_results: QmdSearchResult[] = [];
   private search_loading = false;
   private search_cursor = 0;
   private search_scroll_offset = 0;
   private search_mode: "lex" | "hybrid" = "lex";
   private search_focus: "input" | "results" = "input";
   private search_debounce_timer: ReturnType<typeof setTimeout> | null = null;
   ```

2. **`render_main_search(width, height): string[]`**:
   - Header: `Search: {collection} ─── {mode}`
   - Input line: `> {query}█` (cursor shown when input focused)
   - Separator line
   - Results summary: `{N} results · {mode} · {time}ms`
   - Result list with cursor navigation (when results focused)
   - Each result: path + score, title, snippet (3-4 lines per result)
   - Loading indicator when search is in progress

3. **`handle_main_search_input(key_data)`**:
   - When `search_focus === "input"`:
     - Printable characters → append to `search_query`, debounce lex search
     - `backspace` → remove last char, debounce lex search
     - `ctrl+u` → clear query
     - `enter` → trigger search (lex for now, hybrid in M7)
     - `tab` → switch to results focus
     - `esc` → if query empty, back to overview; if query has text, clear it
   - When `search_focus === "results"`:
     - `j/k` → navigate results
     - `enter` → copy path of selected result
     - `y` → copy path to clipboard
     - `tab` → switch to input focus
     - `esc` → switch to input focus

4. **Debounced lex search**:
   ```typescript
   private schedule_lex_search(): void {
     if (this.search_debounce_timer) clearTimeout(this.search_debounce_timer);
     if (!this.search_query.trim()) {
       this.search_results = [];
       this.tui.requestRender();
       return;
     }
     // selected_collection_key is guaranteed non-null here —
     // search view is unreachable when "All" is selected
     this.search_debounce_timer = setTimeout(async () => {
       this.search_loading = true;
       this.tui.requestRender();
       const results = await this.callbacks.on_search_lex(
         this.search_query,
         this.selected_collection_key!,
       );
       this.search_results = results;
       this.search_loading = false;
       this.search_cursor = 0;
       this.search_scroll_offset = 0;
       this.tui.requestRender();
     }, 200);
   }
   ```

   **Debounce tuning note:** 200ms is the starting value. After this milestone is working,
   manually test against the largest available index. If partial results flood or the UI
   feels laggy, increase to 300-400ms. Document the final value in `constants.ts`.

5. **View switching**:
   - From overview: `s` or `/` → `main_view = "search"`, focus input (only when `selected_collection_key` is non-null)
   - From search: `esc` (with empty query) → `main_view = "overview"`
   - When "All" is selected in sidebar, `s`/`/` does nothing

### Validation

- `tab` to main, `s` opens search view with blinking cursor in input
- Type "extension" → results appear after ~200ms debounce
- Results show path, score, title, snippet
- `tab` switches to results, `j/k` navigates, `tab` back to input
- `esc` with text → clears text; `esc` with empty → back to overview
- Switching collections in sidebar while in search → clears results, stays in search view
- `bun run check` passes

### Files touched

- `extensions/qmd/ui/panel.ts` (modify — add search view rendering and input)

---

## Milestone 7: Search View — Hybrid Mode and Polish

### Goal

`ctrl+t` cycles search mode between lex and hybrid. `enter` in input triggers the active mode's search. Hybrid search shows a loading indicator during the 2-8 second LLM call. Results display is polished with proper snippet formatting.

### Work

1. **Mode cycling** — `ctrl+t` toggles `search_mode` between `"lex"` and `"hybrid"`:
   - Mode indicator in search header: `lex` or `hybrid`
   - Debounced keystroke search always uses lex (fast feedback regardless of mode)
   - `enter` triggers the selected mode's search

2. **Hybrid search execution**:
   ```typescript
   private async execute_search(): Promise<void> {
     if (!this.search_query.trim() || !this.selected_collection_key) return;
     this.search_loading = true;
     this.tui.requestRender();
     try {
       if (this.search_mode === "hybrid") {
         this.search_results = await this.callbacks.on_search_hybrid(
           this.search_query,
           this.selected_collection_key,
         );
       } else {
         this.search_results = await this.callbacks.on_search_lex(
           this.search_query,
           this.selected_collection_key,
         );
       }
     } finally {
       this.search_loading = false;
       this.search_cursor = 0;
       this.search_scroll_offset = 0;
       this.tui.requestRender();
     }
   }
   ```

3. **Loading indicator** — When `search_loading`:
   - Results area shows `Searching… (hybrid)` or `Searching… (lex)`
   - Input still visible but input disabled during hybrid search

4. **Snippet formatting** — QMD returns snippets in `@@ line` format. Parse and clean:
   - Strip `@@ -N,N @@` headers
   - Trim to 2 lines max
   - Prefix with `…` for truncated context

5. **Score display** — Format as percentage: `0.88` → `88%`

6. **Path display** — Strip `qmd://collection/` prefix, truncate long paths with `…`

### Validation

- `ctrl+t` toggles mode indicator between `lex` and `hybrid`
- Type query → lex results appear instantly (debounced)
- Press `enter` in hybrid mode → loading indicator shown → results appear after LLM call
- Results show clean snippets (no raw `@@` headers)
- Scores show as percentages
- Paths are clean relative paths

### Files touched

- `extensions/qmd/ui/panel.ts` (modify — hybrid search, snippet formatting, mode cycling)
- `extensions/qmd/ui/data.ts` (modify — snippet parsing helpers if needed)

---

## Milestone 8: Footer, Docs, and Cleanup

### Goal

Context-sensitive footer, updated documentation, removal of dead code from the old collections view, and final polish.

### Work

1. **Footer rendering** — `render_footer(width): string[]`:
   - Build hint arrays based on `focused_pane` + `main_view` + `search_focus`
   - Left side: contextual shortcuts
   - Right side: collection name + position info
   - Use the footer tables from the spec (Section 7)

2. **Remove dead code**:
   - Delete `render_collections_view()` and all collections-view-only methods
   - Delete `collection_cursor`, `collection_scroll_offset`, `collection_view_height`, `collection_filter_*` fields (replaced by sidebar equivalents)
   - Delete `render_collection_details_block()` (info now shown in main pane overview)
   - Audit `PanelView` type — should now be: sidebar state + main view state, not a single enum

3. **`docs/panel.md`** — Full rewrite:
   - New layout description with sidebar + main pane
   - Updated keyboard shortcuts table (organized by pane/view)
   - New panel states (sidebar focus, main views, search modes)
   - Updated data flow diagram

4. **`extensions/qmd/README.md`** — Update panel description to reflect split-pane layout

5. **Edge cases**:
   - Panel with 0 collections → sidebar shows only "All (0)", main shows init prompt
   - Panel with unavailable QMD → same as current: error message
   - Terminal resize → verify columns rebalance correctly (sidebar stays fixed, main grows)

### Validation

- Footer updates when switching focus (`tab`) and views (`f`, `s`, `esc`)
- Footer shows correct shortcuts for every combination of pane + view
- `bun run check` passes with no unused imports or dead code warnings
- Docs accurately describe the new panel
- Open panel, resize terminal → no rendering artifacts
- `bun test` — existing tests pass (data.test.ts, toggle-state.test.ts)

### Files touched

- `extensions/qmd/ui/panel.ts` (modify — footer, dead code removal)
- `extensions/qmd/docs/panel.md` (rewrite)
- `extensions/qmd/README.md` (modify)

---

## Validation and Acceptance

After all milestones:

1. **`bun run check`** passes with no errors
2. **`bun test`** — all existing tests pass
3. **Manual verification**:
   - Open `/qmd` → two-column panel appears
   - Sidebar lists all collections with "All" at top
   - `j/k` navigates sidebar, `enter` selects, main pane updates
   - `tab` toggles focus with visual feedback
   - `f` opens file tree in main pane, all toggle/apply works
   - `s` opens search, typing shows lex results, `ctrl+t` + `enter` does hybrid
   - `esc` cascades correctly through all states
   - `q` closes from anywhere
   - Footer always shows relevant shortcuts
4. **Plain-text fallback** still works when `hasUI` is false

## Post-Completion Tuning

After all milestones pass, perform these manual validation steps:

1. **Debounce timing**: Open search, type a 3-4 word query quickly against the largest available collection. If results flash/flicker with partial matches before settling, increase debounce from 200ms to 300ms in `constants.ts`.
2. **Sidebar width**: With 4+ collections of varying name lengths, verify nothing truncates badly. Adjust `QMD_SIDEBAR_INNER_WIDTH` if needed.
3. **Search result density**: With 10+ results, verify scrolling is smooth and results don't clip at the bottom of the main pane.

## Idempotence and Recovery

Each milestone is a commit. If a milestone breaks something:
- `git stash` or `git revert` to go back to the last working milestone
- Milestones 1-4 are pure UI refactors — no data layer changes, no risk to QMD index
- Milestone 5 is additive SDK wrappers — no changes to existing functions
- Milestones 6-7 are additive UI — search view doesn't affect overview or files

## Interfaces and Dependencies

| Dependency | Source | Used For |
|------------|--------|----------|
| `@tobilu/qmd` SDK | `node_modules/@tobilu/qmd` | `store.searchFTS()`, `hybridQuery()` |
| Pi TUI API | `@mariozechner/pi-tui` | `matchesKey`, `truncateToWidth`, `visibleWidth`, `TUI` |
| Pi Agent API | `@mariozechner/pi-coding-agent` | `ctx.ui.custom()`, `Theme` |
| `QmdPanelSnapshot` | `extensions/qmd/ui/data.ts` | Panel data source |
| `ToggleState` | `extensions/qmd/ui/toggle-state.ts` | File index toggle tracking |
| `QmdPanelCallbacks` | `extensions/qmd/ui/panel.ts` | Action interface between panel and extension |
