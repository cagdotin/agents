# QMD TUI Panel — Rebuild Spec

**Retired:** 2026-04-15

**What it was:** An interactive split-pane TUI dashboard for inspecting and managing the QMD index. Opened as a wide overlay panel with a persistent collection sidebar (left) and a context-sensitive main pane (right) supporting overview, files, search, and preview views.

**Why it was retired:** The TUI panel added significant surface area (~2,400 lines across 5 UI files + command wiring) for a feature that was rarely used interactively. The remaining QMD extension (init pipeline, skill injection, prompt hints, freshness detection, footer status) covers the agent-facing workflow without a TUI.

---

## User-facing surface

### Commands and shortcuts

| Entry point | Behavior |
|-------------|----------|
| `/qmd` (no args) | Open/toggle the panel (or plain-text fallback when `hasUI` is false) |
| `/qp` | Alias for `/qmd` |
| `Ctrl+Alt+Q` | Toggle the panel |
| `/qmd status` | Print text status (kept — not part of the TUI) |
| `/qmd update` | Run collection update (kept — not part of the TUI) |
| `/qmd init` | Start onboarding (kept — not part of the TUI) |

### Panel layout

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
│                       │                                            │
├───────────────────────┴────────────────────────────────────────────┤
│  tab switch · / filter · j/k nav · enter select     agents · 2/4  │
╰────────────────────────────────────────────────────────────────────╯
```

- Width: 90% of terminal, min 90 columns, max height 80%
- Sidebar: Fixed 24-char inner width. Always visible.
- Main pane: Fills remaining width. Four views: overview, files, search, preview.
- Footer: Full width, context-sensitive shortcuts.

### Focus model

`tab` switches focus between sidebar and main pane. Focused pane has accent-colored border labels; unfocused has dim labels.

**Esc cascade** — resolves most local state first:
1. Sidebar filter active → clear filter
2. Search with text → clear text
3. Search with empty → back to overview
4. Files view → back to overview
5. Otherwise → close panel

### Keyboard shortcuts

**Global:** `q` close, `Ctrl+C` close, `Ctrl+Alt+Q` toggle, `tab` switch panes.

**Sidebar:** `j/k` navigate, `enter` select, `/` filter, `g/G` top/bottom, `u` update (bound), `r` refresh, `i` init, `esc` clear filter or close.

**Overview:** `f`/`enter` open files, `s`/`/` open search, `u` update, `r` refresh, `j/k` scroll, `esc` switch to sidebar.

**Files:** `j/k` navigate tree, `enter` expand/collapse, `space` toggle index inclusion (bound), `a` apply pending, `esc`/`h` back to overview.

**Search (input):** type for debounced lex search, `enter` execute, `ctrl+t` cycle mode (lex ↔ hybrid), `tab` focus results, `ctrl+u` clear, `esc` clear or back.

**Search (results):** `j/k` navigate, `enter`/`y` copy path, `tab`/`esc` focus input.

### File tree indicators

| Indicator | Meaning |
|-----------|---------|
| `●` | Indexed, no pending change |
| `○` | Not indexed, no pending change |
| `◉` | Pending add |
| `◎` | Pending remove |

Directories show: `●` all, `◐` some, `○` none.

---

## Data model

### QmdPanelSnapshot

Flat, serializable struct built by `build_qmd_panel_snapshot()`. Fields:

- **Binding:** `binding_status`, `repo_root`, `collection_key`, `bound_collection_key`, `selected_collection_scope` ("bound" | "external" | "none"), `supports_update_action`, `supports_file_toggling`, `read_only_reason`, `binding_source`, `error_reason`
- **Collections:** array of `{ key, repo_root, glob_pattern, doc_count, is_bound_collection }`
- **Freshness:** `freshness_status`, `stale_paths`, `stale_count` (bound collection only)
- **Index stats:** `total_documents`, `needs_embedding`, `has_vector_index`, `glob_pattern`, `last_indexed_at`, `last_indexed_commit`
- **Contexts:** array of `{ path, annotation }` for selected collection
- **File paths:** `indexed_paths`, `filesystem_paths`, `file_paths_source` ("filesystem" | "qmd" | "none")

### QmdSearchResult

Normalized search result: `{ file, display_path, title, score, snippet, docid, source: "lex" | "hybrid" }`.

Three normalizers: `normalize_lex_result()`, `normalize_vector_result()`, `normalize_hybrid_result()`.

### ToggleState

Manages pending file inclusion/exclusion changes:
- `indexed_set` — baseline indexed paths
- `pending_adds` / `pending_removes` — pending mutations
- `is_effectively_indexed()`, `toggle_file()`, `toggle_dir()`, `toggle_node()`, `has_pending()`, `pending_count()`, `clear()`

### File tree

Hierarchical tree built from flat paths:
- `build_file_tree(paths, indexed_set)` — builds nodes with single-child directory collapsing
- `flatten_tree(roots, collapsed)` — produces cursor-navigable flat list
- `collect_file_paths(node)` — gathers all descendant file paths

Helper functions: `count_files()`, `compute_dir_index_status()`, `sort_tree()`, `collapse_single_child_dirs()`.

Utility: `format_relative_time()`, `group_paths_by_directory()`, `wrap_text()`.

---

## Lifecycle

### Panel wiring (command.ts)

`register_qmd_command()` registered:
- `/qmd` command with subcommand dispatch (status, update, init, or open panel)
- `/qp` alias command
- `Ctrl+Alt+Q` shortcut

Panel lifecycle managed via `panel_open` flag and `close_panel` closure. Callbacks wired in `open_or_toggle_panel()`:
- `get_snapshot()` — refreshes binding + freshness + builds snapshot
- `on_update()` — runs `update_collection()`, re-indexes dotpath files, embeds, writes marker
- `on_init()` — scans repo, builds draft proposal, activates init tool, sends kickoff message
- `on_close()` — closes panel
- `on_embed()` — generates pending embeddings
- `on_search_lex/vector/hybrid()` — delegates to SDK wrappers
- `on_get_document()` — fetches document content for preview
- `on_toggle_files()` — deactivates removed files, indexes added files, updates marker extra_paths

### Runtime integration (runtime.ts)

- `close_panel` field on `QmdExtensionState` — called during bootstrap and shutdown
- `session_shutdown` event closes the panel before closing the store

### Entry point (index.ts)

`session_start` called `register_qmd_command(pi, state)` to wire everything up.

---

## Dependencies

- `@mariozechner/pi-coding-agent` — `ExtensionAPI`, `ExtensionContext`, `Theme`
- `@mariozechner/pi-tui` — `TUI`, `matchesKey`, `truncateToWidth`, `visibleWidth`
- Pi's `ctx.ui.custom()` API — overlay panel rendering
- Pi's `ctx.ui.notify()` — notification fallback
- `core/qmd-store.ts` — all SDK operations (search, update, index, deactivate, etc.)
- `domain/repo-binding.ts` — binding detection, marker I/O
- `domain/freshness.ts` — freshness checking

---

## Design decisions

- **Snapshot-based rendering** — the panel receives a flat `QmdPanelSnapshot` struct and renders it. No domain logic in the UI layer. Actions flow back via callbacks.
- **Split-pane layout** — sidebar always visible for collection switching; main pane shows context-sensitive views. Chosen over tab-based layout for persistent navigation.
- **NERDTree-style file tree** — familiar vi-style navigation with single-child directory collapsing to reduce noise.
- **Debounced search** — lex search fires ~200ms after keystroke; full search (hybrid) requires explicit `enter`. Avoids expensive vector queries on every keystroke.
- **Toggle state as pending changes** — file inclusion changes are staged locally and applied in batch (`a` key), preventing accidental index mutations from casual browsing.
- **Plain-text fallback** — when `ctx.hasUI` is false, `/qmd` prints a text summary via `build_plain_text_summary()` instead of failing silently.
