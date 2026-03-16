# QMD Panel Split-Pane Redesign — Implementation Spec

Status: ready for implementation
Date: 2026-03-16
Track: agent-memory

## Read These First

You need context from these files before writing any code:

| Document | Why |
|----------|-----|
| `docs/specs/2026-03-16-qmd-panel-split-pane-redesign.md` | Full design spec — layout, focus model, sidebar, search, footer, resolved questions |
| `docs/exec-plans/active/2026-03-16-qmd-panel-split-pane-redesign.md` | 8-milestone breakdown with per-milestone work items, validation, and file lists |
| `extensions/qmd/ui/panel.ts` | Current panel implementation (~680 lines) — **you are rewriting this file** |
| `extensions/qmd/ui/data.ts` | Snapshot type and file tree utilities — you will add search result types here |
| `extensions/qmd/ui/constants.ts` | Panel width, shortcuts — you will update these |
| `extensions/qmd/core/qmd-store.ts` | QMD SDK wrapper — you will add search functions here |
| `extensions/qmd/extension/command.ts` | Wires callbacks between extension and panel — you will add search/embed callbacks |
| `extensions/qmd/ui/toggle-state.ts` | File toggle tracking — **do not modify**, verify it still works |
| `extensions/qmd/docs/panel.md` | Panel documentation — you will rewrite this at the end |

For Pi TUI API reference, read the tui docs at:
`/Users/cgn/.local/share/mise/installs/node/23.3.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md`

Key TUI APIs you will use: `matchesKey`, `truncateToWidth`, `visibleWidth`, `TUI.requestRender()`, and the overlay `{ overlay: true, overlayOptions: { ... } }` pattern.

## What You Are Building

You are transforming the QMD panel from a single-column sequential drill-in UI into a persistent two-column split-pane layout with interactive search. When done:

1. `/qmd` opens a wide panel (~90% terminal width) with a collection sidebar on the left and a content pane on the right.
2. `tab` switches focus between the two panes. Focused pane has accent-colored borders, unfocused is dim.
3. The sidebar always shows all QMD collections. Navigate with `j/k`, select with `enter`, filter with `/`.
4. The main pane shows one of three views: **overview** (default), **files** (file tree), or **search** (new).
5. Search provides debounced lex results on keystroke and full hybrid search on `enter`.
6. All existing functionality is preserved: file tree toggle, freshness, update, init.

## Milestone Order

**Implement these in order. Each milestone produces a working panel. Do not skip ahead.**

Complete one milestone fully (code + `bun run check` passes + manual verification) before starting the next. Commit after each milestone.

### Milestone 1 — Split-Pane Frame and Sidebar Rendering

**Goal:** Two-column layout renders. Sidebar shows collections. Main pane shows a placeholder. Panel opens and closes.

**Files to modify:**

1. `extensions/qmd/ui/constants.ts` — update panel dimensions:
   ```typescript
   // Replace the existing QMD_PANEL_WIDTH = 80 with:
   export const QMD_PANEL_WIDTH = "90%";
   export const QMD_PANEL_MIN_WIDTH = 90;
   export const QMD_SIDEBAR_INNER_WIDTH = 24;
   ```

2. `extensions/qmd/ui/panel.ts` — the big change. You need to:

   a. Update `show_qmd_panel()` overlay options:
   ```typescript
   overlayOptions: {
     anchor: "center" as const,
     width: QMD_PANEL_WIDTH,
     minWidth: QMD_PANEL_MIN_WIDTH,
     maxHeight: "80%",
   },
   ```

   b. Add new state fields to `QmdPanel`:
   ```typescript
   private focused_pane: "sidebar" | "main" = "sidebar";
   private main_view: "overview" | "files" | "search" = "overview";

   // Sidebar state (replaces old collection_* fields)
   private sidebar_cursor = 0;
   private sidebar_scroll_offset = 0;
   private sidebar_filter_query = "";
   private sidebar_filter_editing = false;
   ```

   c. Rewrite `render(width)` to compose two columns:
   ```
   ╭─ Collections ────────┬─ {name} ────────────────╮  ← top border with labels
   │  sidebar content      │  main pane content       │  ← body rows (merged line-by-line)
   │  ...                  │  ...                      │
   ├───────────────────────┴──────────────────────────┤  ← footer separator
   │  footer hints                                     │  ← footer
   ╰───────────────────────────────────────────────────╯  ← bottom border
   ```

   The render method should:
   - Compute `sidebar_w = QMD_SIDEBAR_INNER_WIDTH` and `main_w = width - sidebar_w - 3` (2 outer `│` + 1 separator `│`)
   - Compute `body_h` from max panel height minus borders (top, footer sep, footer, bottom = 4 lines)
   - Call `render_sidebar(sidebar_w, body_h): string[]` → returns `body_h` lines
   - Call a placeholder for main pane → returns `body_h` lines (just show collection name centered or "Overview")
   - Merge line-by-line: `│` + sidebar_line + `│` + main_line + `│`
   - Build top border: `╭─ Collections ─...─┬─ {name} ─...─╮` using `─` fill
   - Build footer separator: `├─...─┴─...─┤`
   - Build footer + bottom border

   d. Implement `render_sidebar(width, height): string[]`:
   - Line 0: empty
   - Line 1+: collection entries from `this.snapshot.collections`
   - First entry is synthetic: `All ({total_collections})` where total is `this.snapshot.collections.length`
   - Each real entry: `  {cursor?} {name}  {● if bound} {doc_count}`
     - `▸` cursor marker on the selected row
     - `●` on the collection where `is_bound_collection === true`
     - doc count right-aligned
   - Pad/fill remaining lines to reach `height`
   - If `sidebar_filter_editing`, show filter input at the bottom

   e. Keep `handleInput` minimal: just `q`, `esc`, `ctrl+c`, `ctrl+alt+q` to close.

**Verify:** `bun run check` passes. Open `/qmd` in Pi. Two columns visible. Sidebar shows "All" + collections. Main shows placeholder. `q` closes.

---

### Milestone 2 — Focus Model and Input Routing

**Goal:** `tab` toggles focus. Visual feedback on borders. Sidebar `j/k` navigation and collection selection work.

**Files:** `extensions/qmd/ui/panel.ts` only.

1. Rewrite `handleInput(key_data)`:
   ```typescript
   // Global keys first
   if (matchesKey(key_data, "ctrl+c") || matchesKey(key_data, QMD_PANEL_SHORTCUT)) { this.done(); return; }
   if (matchesKey(key_data, "q")) { this.done(); return; }
   if (matchesKey(key_data, "tab")) {
     this.focused_pane = this.focused_pane === "sidebar" ? "main" : "sidebar";
     this.tui.requestRender();
     return;
   }
   // Route to focused pane
   if (this.focused_pane === "sidebar") {
     this.handle_sidebar_input(key_data);
   } else {
     this.handle_main_input(key_data);
   }
   ```

2. Implement `handle_sidebar_input(key_data)`:
   - `j/k/↑↓` — move `sidebar_cursor` (0 = "All", 1+ = collections)
   - `enter` — select collection: if cursor 0 → `selected_collection_key = null`; else → `selected_collection_key = collections[cursor - 1].key`. Call `this.refresh()` then set `main_view = "overview"`.
   - `/` — enter filter mode (`sidebar_filter_editing = true`)
   - Filter typing mode: printable chars append to `sidebar_filter_query`, `backspace` removes, `esc` exits filter mode, `enter` finishes filter, `ctrl+u` clears
   - `g`/`G`, `pageUp`/`pageDown` — jump navigation
   - `esc` — if filter active, clear filter; else close panel

3. Update `render()` top border to color labels by focus:
   - "Collections" label: `theme.fg("accent", ...)` when `focused_pane === "sidebar"`, `theme.fg("dim", ...)` otherwise
   - Collection name label: `theme.fg("accent", ...)` when `focused_pane === "main"`, `theme.fg("dim", ...)` otherwise

4. `handle_main_input(key_data)` — stub for now: `esc` closes panel.

**Verify:** `tab` toggles border colors. `j/k` moves sidebar cursor. `enter` on a collection updates `selected_collection_key` (visible in main pane header changing). `/` opens filter, typing filters, `esc` clears.

---

### Milestone 3 — Overview in Main Pane

**Goal:** Main pane renders the existing overview content (info card, index stats, contexts, stale files).

**Files:** `extensions/qmd/ui/panel.ts` only.

1. Replace the main pane placeholder with `render_main_pane(width, height)` that dispatches:
   ```typescript
   private render_main_pane(width: number, height: number): string[] {
     if (this.main_view === "overview") return this.render_main_overview(width, height);
     if (this.main_view === "files") return this.render_main_files(width, height);
     if (this.main_view === "search") return this.render_main_search(width, height);
     return this.render_main_overview(width, height);
   }
   ```

2. Implement `render_main_overview(width, height)`:
   - Port the existing `render_selected_overview()` content, adjusting all width calculations from `iw` (old full inner width) to the `width` parameter (main pane inner width)
   - Render: collection info card, index section, contexts section, stale section — same data
   - When `selected_collection_key === null` ("All" selected): show global health (total docs, embedding status, collection count), skip freshness/contexts/stale
   - Scrollable: track `overview_scroll_offset`, scroll with `j/k` when `focused_pane === "main"` and `main_view === "overview"`

3. Wire existing actions — when main is focused in overview:
   - `u` triggers update (bound collection only)
   - `r` refreshes snapshot

4. Reuse the existing rendering helpers: `render_collection_info_card()`, `section_header()`, `render_card()`, `status_badge()`. Adjust their width parameters.

**Verify:** Open `/qmd`. Sidebar shows collections. Main shows overview with stats. Switch collections with sidebar → main updates. `j/k` in main scrolls overview. `u` triggers update.

---

### Milestone 4 — Files View in Main Pane

**Goal:** `f` or `enter` in main pane overview → file tree view. All existing tree functionality works.

**Files:** `extensions/qmd/ui/panel.ts` only.

1. Port existing `render_files_view()` into `render_main_files(width, height)`:
   - Same NERDTree rendering, adjusted for main pane width
   - Tree state fields (`tree_roots`, `tree_collapsed`, `tree_flat`, `tree_cursor`, etc.) stay on the class

2. Port existing `handle_files_input()` into `handle_main_files_input(key_data)`:
   - `j/k` navigate tree, `enter`/`l`/`→` expand/collapse, `space` toggle, `a` apply
   - `esc`/`h`/`←` → `main_view = "overview"`, clear toggle state

3. View switching logic in `handle_main_input()`:
   ```typescript
   if (this.main_view === "overview") {
     if ((matchesKey(key_data, "f") || matchesKey(key_data, "enter")) && this.selected_collection_key) {
       this.open_tree_view();
       this.main_view = "files";
       return;
     }
     // ... other overview keys
   } else if (this.main_view === "files") {
     this.handle_main_files_input(key_data);
   }
   ```

4. Files unavailable when "All" is selected — `f`/`enter` does nothing when `selected_collection_key === null`.

5. When sidebar selection changes (different collection selected), reset `main_view = "overview"`.

**Verify:** `tab` to main, `f` opens file tree. Tree renders in the right column. `space` toggles, `a` applies. `esc` back to overview. `f` does nothing when "All" selected.

---

### Milestone 5 — Search SDK Wrappers

**Goal:** Data layer for search. No UI changes.

**Files to modify:**

1. `extensions/qmd/core/qmd-store.ts` — add search wrappers:
   ```typescript
   import { hybridQuery, type HybridQueryResult, type SearchResult } from "@tobilu/qmd";
   // or use dynamic import if hybridQuery isn't directly exported

   export async function search_lex(
     query: string,
     collection: string,
     limit = 20,
   ): Promise<SearchResult[]> {
     return with_store("search (lex)", async (store) => {
       return store.searchFTS(query, limit, collection);
     });
   }

   export async function search_hybrid(
     query: string,
     collection: string,
     limit = 20,
   ): Promise<HybridQueryResult[]> {
     return with_store("search (hybrid)", async (store) => {
       return hybridQuery(store, query, { collection, limit });
     });
   }
   ```

   Note on `searchFTS`: it's synchronous on the store object, but `with_store()` is async (lazy store init). Making `search_lex` async is fine — after the first call the store Promise resolves instantly.

   **Important:** Check the actual import path. `hybridQuery` may need `import { hybridQuery } from "@tobilu/qmd"` or might be available differently. Verify with `rg "export.*hybridQuery" node_modules/@tobilu/qmd/dist/`.

2. `extensions/qmd/ui/data.ts` — add search result type:
   ```typescript
   export interface QmdSearchResult {
     file: string;           // virtual path (qmd://collection/path.md)
     display_path: string;   // relative path for display (stripped of qmd://collection/ prefix)
     title: string;
     score: number;
     snippet: string;        // cleaned snippet text (no @@ headers)
     docid: string;
     source: "lex" | "hybrid";
   }
   ```

   Add normalizer functions that convert SDK results to `QmdSearchResult`:
   ```typescript
   export function normalize_lex_result(result: SearchResult, collection: string): QmdSearchResult
   export function normalize_hybrid_result(result: HybridQueryResult): QmdSearchResult
   ```

   For snippet cleaning: strip `@@ -N,N @@` headers from the snippet/body, trim to ~200 chars, prefix with `…` if truncated.

   For `display_path`: parse `result.file` (format `qmd://collection/path.md`), strip the `qmd://collection/` prefix. Use `parseVirtualPath` from the QMD SDK if available, or simple string manipulation.

3. `extensions/qmd/ui/panel.ts` — extend `QmdPanelCallbacks`:
   ```typescript
   export interface QmdPanelCallbacks {
     get_snapshot: (selected_collection_key?: string) => Promise<QmdPanelSnapshot>;
     on_update: () => Promise<void>;
     on_init: () => void;
     on_close: () => void;
     on_toggle_files: (adds: string[], removes: string[]) => Promise<void>;
     on_embed: () => Promise<void>;
     on_search_lex: (query: string, collection: string) => Promise<QmdSearchResult[]>;
     on_search_hybrid: (query: string, collection: string) => Promise<QmdSearchResult[]>;
   }
   ```

4. `extensions/qmd/extension/command.ts` — wire the new callbacks in `panel_callbacks`:
   ```typescript
   on_embed: async () => {
     await embed_pending();
     await refresh_runtime_state(ctx, state);
   },
   on_search_lex: async (query, collection) => {
     const { search_lex } = await import("../core/qmd-store.js");
     const { normalize_lex_result } = await import("../ui/data.js");
     const raw = await search_lex(query, collection);
     return raw.map(r => normalize_lex_result(r, collection));
   },
   on_search_hybrid: async (query, collection) => {
     const { search_hybrid } = await import("../core/qmd-store.js");
     const { normalize_hybrid_result } = await import("../ui/data.js");
     const raw = await search_hybrid(query, collection);
     return raw.map(r => normalize_hybrid_result(r));
   },
   ```

   Note: use top-level imports instead of dynamic imports if the module is already imported in the file.

**Verify:** `bun run check` passes. Panel still opens and works (no UI changes). If you want to test search manually: add a temporary log in one of the callbacks and trigger it.

---

### Milestone 6 — Search View: Input and Lex Results

**Goal:** `s` or `/` from main pane overview opens search. Typing triggers debounced lex results. `tab` toggles input/results focus.

**Files:** `extensions/qmd/ui/panel.ts` only.

1. Add search state fields:
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

2. Implement `render_main_search(width, height): string[]`:
   ```
   ─ Search: {collection} ─── lex ─────────
     > query text here█                     ← input line (█ = cursor when focused)
   ─────────────────────────────────────────
     3 results · lex · 4ms                  ← summary

     ▸ path/to/file.md                88%   ← selected result
       Document Title
       …snippet text here…

       another/file.md                53%   ← unselected result
       Another Title
       …more snippet text…
   ```

   - Input line: `> {query}█` — show cursor indicator when `search_focus === "input"`
   - If `search_loading`: show `Searching…` instead of results
   - Each result takes 3-4 lines: path + score, title, snippet, blank line
   - Cursor marker `▸` on selected result when `search_focus === "results"`
   - Scores as percentages: `Math.round(score * 100) + "%"`
   - Scroll results if they exceed available height

3. Implement `handle_main_search_input(key_data)`:

   When `search_focus === "input"`:
   - Printable chars → append to `search_query`, call `schedule_lex_search()`
   - `backspace` → remove last char, call `schedule_lex_search()`
   - `ctrl+u` → clear query and results
   - `enter` → call `execute_search()` (uses current `search_mode`)
   - `tab` → `search_focus = "results"` (only if results exist)
   - `esc` → if query not empty, clear it; if empty, `main_view = "overview"`

   When `search_focus === "results"`:
   - `j/k` → move `search_cursor`
   - `enter` → copy `search_results[search_cursor].display_path` to clipboard
   - `y` → same as enter (copy path)
   - `tab` → `search_focus = "input"`
   - `esc` → `search_focus = "input"`

4. Implement `schedule_lex_search()`:
   ```typescript
   private schedule_lex_search(): void {
     if (this.search_debounce_timer) clearTimeout(this.search_debounce_timer);
     if (!this.search_query.trim() || !this.selected_collection_key) {
       this.search_results = [];
       this.tui.requestRender();
       return;
     }
     this.search_debounce_timer = setTimeout(async () => {
       this.search_loading = true;
       this.tui.requestRender();
       try {
         this.search_results = await this.callbacks.on_search_lex(
           this.search_query,
           this.selected_collection_key!,
         );
       } catch {
         this.search_results = [];
       }
       this.search_loading = false;
       this.search_cursor = 0;
       this.search_scroll_offset = 0;
       this.tui.requestRender();
     }, 200);
   }
   ```

5. Clipboard copy helper:
   ```typescript
   import { exec } from "node:child_process";
   private copy_to_clipboard(text: string): void {
     exec(`printf '%s' ${JSON.stringify(text)} | pbcopy`);
   }
   ```

6. View switching — in `handle_main_input()` for overview:
   ```typescript
   if ((matchesKey(key_data, "s") || get_printable_char(key_data) === "/") && this.selected_collection_key) {
     this.main_view = "search";
     this.search_query = "";
     this.search_results = [];
     this.search_focus = "input";
     this.tui.requestRender();
     return;
   }
   ```
   Search is only available when a specific collection is selected (not "All").

**Verify:** `tab` to main, `s` opens search. Type "extension" → results appear after ~200ms. Results show path, percentage score, title, snippet. `tab` to results, `j/k` navigates. `enter`/`y` copies path. `esc` cascades: clear text → back to overview. `s` does nothing when "All" is selected.

---

### Milestone 7 — Hybrid Mode and Polish

**Goal:** `ctrl+t` cycles search mode. Hybrid search works with loading state. Snippets are clean.

**Files:** `extensions/qmd/ui/panel.ts`, optionally `extensions/qmd/ui/data.ts`.

1. Mode cycling — in `handle_main_search_input()`:
   ```typescript
   if (matchesKey(key_data, "ctrl+t")) {
     this.search_mode = this.search_mode === "lex" ? "hybrid" : "lex";
     this.tui.requestRender();
     return;
   }
   ```

2. `execute_search()` uses the active mode:
   ```typescript
   private async execute_search(): Promise<void> {
     if (!this.search_query.trim() || !this.selected_collection_key) return;
     this.search_loading = true;
     this.tui.requestRender();
     try {
       const callback = this.search_mode === "hybrid"
         ? this.callbacks.on_search_hybrid
         : this.callbacks.on_search_lex;
       this.search_results = await callback(this.search_query, this.selected_collection_key);
     } catch {
       this.search_results = [];
     } finally {
       this.search_loading = false;
       this.search_cursor = 0;
       this.search_scroll_offset = 0;
       this.tui.requestRender();
     }
   }
   ```

3. Show mode in search header: `Search: {collection} ─── {mode}` where mode is `lex` or `hybrid` with appropriate color.

4. Loading state: when `search_loading`, show `Searching… ({mode})` in results area. Disable input during hybrid search (ignore printable chars).

5. Snippet polish in `data.ts` normalizers (if not already done in M5):
   - Strip `@@ -N,N @@` diff headers from snippet/body text
   - Trim to max ~200 chars
   - Prefix truncated snippets with `…`

6. Score display: `Math.round(score * 100) + "%"` — already in M6, just verify.

7. Path display: ensure `display_path` is stripped of `qmd://collection/` prefix in normalizers.

**Verify:** `ctrl+t` toggles mode indicator. In hybrid mode, `enter` shows loading, then results (takes 2-8 sec). Snippets are clean (no `@@` headers). Paths are relative. Scores are percentages.

---

### Milestone 8 — Footer, Docs, and Cleanup

**Goal:** Context-sensitive footer. Dead code removal. Documentation rewrite.

**Files:** `extensions/qmd/ui/panel.ts`, `extensions/qmd/docs/panel.md`, `extensions/qmd/README.md`.

1. Implement `render_footer(width): string[]`:

   Build shortcut hints based on `focused_pane` + `main_view` + `search_focus`:

   | State | Hints |
   |-------|-------|
   | Sidebar focused | `tab switch · / filter · j/k nav · enter select · u update · e embed` |
   | Main: Overview | `tab switch · f files · s search · u update · r refresh` |
   | Main: Files | `tab switch · space toggle · a apply · enter expand · esc back` |
   | Main: Search (input) | `tab results · ctrl+t mode · enter search · esc back` |
   | Main: Search (results) | `tab input · j/k nav · enter copy · y yank · esc back` |

   Right side: collection name + position info where applicable.

   Render as: `  {hints joined by " · "}` left-aligned, collection/position right-aligned, separated by space fill.

2. Remove dead code from old panel design:
   - Delete `render_overview()` (the old full-width overview — replaced by `render_main_overview()`)
   - Delete `render_collections_view()` and all collections-view-only methods
   - Delete `handle_collections_input()` (replaced by `handle_sidebar_input()`)
   - Delete `render_collection_details_block()`
   - Delete old `collection_cursor`, `collection_scroll_offset`, `collection_view_height`, `collection_filter_*` fields
   - Delete the old `PanelView` type if it's no longer used
   - Delete the old `frame_content()` method if replaced by new framing

3. Rewrite `extensions/qmd/docs/panel.md`:
   - New layout description: sidebar + main pane
   - Updated keyboard shortcuts table organized by pane and view
   - New panel states (sidebar focus, main views, search modes)
   - Data flow diagram updated

4. Update `extensions/qmd/README.md`:
   - Panel description reflects split-pane layout
   - Mention search capability

5. Edge cases to test:
   - 0 collections → sidebar shows "All (0)", main shows init prompt
   - QMD unavailable → error message renders correctly
   - Terminal resize → columns rebalance (sidebar fixed, main grows)

**Verify:** Footer updates when switching focus and views. `bun run check` passes with no dead code. `bun test` passes. Docs match actual behavior.

---

## Rules

- **One milestone at a time.** Don't start M2 until M1 passes `bun run check` and manual verification.
- **Commit after each milestone.** Each commit should be a working state.
- **Don't modify `toggle-state.ts`.** It tracks file index changes and should work as-is.
- **Don't modify the plain-text fallback** (`plain-text.ts`). It should continue to work when `hasUI` is false.
- **Reuse existing helpers** where possible: `render_card()`, `section_header()`, `status_badge()`, `format_relative_time()`, `display_key()`, `pad_to_width()`, `get_printable_char()`. Adapt their width parameters but don't rewrite them unnecessarily.
- **Keep the `show_qmd_panel()` function signature stable.** Callbacks grow but the function shape doesn't change.
- **Search is collection-scoped only.** When "All" is selected, `s`/`/` does nothing. No global search in v1.
- **`enter` on search result copies path to clipboard.** Use `pbcopy` on macOS.
- **Use `theme.fg()` for all colors.** Key color names: `accent`, `dim`, `muted`, `warning`, `error`, `borderMuted`, `borderAccent`.
- **Every line from `render()` must not exceed `width`.** Use `truncateToWidth()` on all output lines.
