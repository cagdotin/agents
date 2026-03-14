# QMD File Tree Toggle — Design Plan

## Goal

Replace the current files view in the QMD panel with an interactive file tree that:
1. Shows **all `.md` files** on the filesystem (matching the collection's glob)
2. Marks each file as **indexed (●)** or **not indexed (○)**
3. Lets the user **toggle** files/dirs with `space`, expand/collapse dirs with `enter`
4. Applies changes via SDK calls on exit

## Current State

- The files view (`view === "files"`) builds a tree from `snapshot.indexed_paths` only — files already in QMD.
- `enter` toggles dir expand/collapse. There's no selection/toggle concept.
- Tree data structures (`FileTreeNode`, `FlatTreeEntry`, `build_file_tree`, `flatten_tree`) live in `ui/data.ts`.

## Design

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Filesystem   │     │  QMD Store   │     │    Panel     │
│  scan_md_     │────▶│  indexed     │────▶│  tree with   │
│  files()      │     │  paths set   │     │  ●/○ markers │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                           space toggles
                                                 │
                                           ┌─────▼─────┐
                                           │ Pending    │
                                           │ changes    │
                                           │ (add/rm)   │
                                           └─────┬─────┘
                                                 │
                                           on exit/apply
                                                 │
                                    ┌────────────▼────────────┐
                                    │ deactivateDocument()    │
                                    │ + update() + embed()    │
                                    └─────────────────────────┘
```

### 1. Filesystem Scan — `scan_md_files(repo_root, glob_pattern)`

New function in `ui/data.ts` (or `core/qmd-store.ts`).

- Walks `repo_root` finding all files matching `glob_pattern` (default `**/*.md`)
- Skips `.git`, `node_modules`, `dist`, `build`, etc. (reuse `SKIPPED_DIRECTORIES` from onboarding)
- Returns `string[]` of repo-relative posix paths
- This is a pure filesystem operation, no QMD dependency

**Location:** `core/qmd-store.ts` — add `scan_filesystem_paths(repo_root, glob_pattern)` that uses the SDK's existing glob infrastructure, or a simple `readdir` walk with the same skip list as onboarding.

### 2. Snapshot Changes

Add to `QmdPanelSnapshot`:
```ts
// All .md file paths on the filesystem (superset of indexed_paths)
filesystem_paths: string[];
```

`build_qmd_panel_snapshot()` calls `scan_md_files()` when binding is "indexed" to populate this.

### 3. Tree Construction

Change `open_tree_view()` to build the tree from **`filesystem_paths`** (all files) instead of `indexed_paths`.

The `FileTreeNode` gets a new field:
```ts
indexed: boolean;  // true if in QMD index
```

`build_file_tree()` gains a second parameter — a `Set<string>` of indexed paths — and tags each file node.

Dir nodes get a computed state: `all_indexed`, `some_indexed`, `none_indexed` for rendering a mixed-state indicator.

### 4. Pending Changes Tracking

New panel state:
```ts
private pending_adds: Set<string> = new Set();    // paths to add (currently not indexed)
private pending_removes: Set<string> = new Set(); // paths to remove (currently indexed)
```

When user presses `space`:
- On a **file**: toggle its pending state
  - If indexed and not in `pending_removes` → add to `pending_removes`
  - If indexed and in `pending_removes` → remove from `pending_removes` (cancel)
  - If not indexed and not in `pending_adds` → add to `pending_adds`
  - If not indexed and in `pending_adds` → remove from `pending_adds` (cancel)
- On a **dir**: toggle all descendant files (same logic, batch)

### 5. Rendering

Each file line shows:
```
● README.md          ← indexed, no pending change
○ CHANGELOG.md       ← not indexed, no pending change  
◉ new-file.md        ← not indexed → pending add (highlighted)
◎ old-file.md        ← indexed → pending remove (highlighted)
```

Dir lines show aggregate indicator:
```
▸ ● docs/            ← all children indexed
▸ ◐ extensions/      ← some children indexed  
▸ ○ drafts/          ← no children indexed
```

### 6. Key Bindings (files view)

| Key | Action |
|---|---|
| `enter` / `l` / `right` | Expand/collapse dir |
| `space` | Toggle file/dir inclusion |
| `j` / `k` / `↑` / `↓` | Navigate |
| `a` | Apply pending changes |
| `esc` / `q` | Back (warn if pending changes) |

### 7. Apply Logic — `apply_pending_changes()`

New callback added to `QmdPanelCallbacks`:
```ts
on_toggle_files: (adds: string[], removes: string[]) => Promise<void>;
```

Implementation in `command.ts`:
1. For each path in `removes`: call `store.internal.deactivateDocument(collection, path)`
2. If `adds` is non-empty: call `update_collection(collection)` to re-index (picks up new files)
3. If anything changed embeddings: call `embed_pending()`
4. Write updated repo marker

This keeps the UI as pure SDK wrapper — it just passes path lists up.

### 8. Files Changed

| File | Changes |
|---|---|
| `core/qmd-store.ts` | Add `scan_filesystem_paths()`, `deactivate_document()` |
| `ui/data.ts` | Update `QmdPanelSnapshot` (add `filesystem_paths`), update `FileTreeNode` (add `indexed`), update `build_file_tree()` signature, add `build_qmd_panel_snapshot` changes |
| `ui/panel.ts` | Rework files view: pending state tracking, `space` handler, apply flow, updated rendering with ●/○ markers, aggregate dir state |
| `extension/command.ts` | Wire `on_toggle_files` callback |

### 9. Risks / Decisions

- **Large repos**: Filesystem scan could be slow. Mitigate with the same `SCAN_LIMIT` (6000 entries) and `SKIPPED_DIRECTORIES` from onboarding.
- **Glob matching**: The collection may have a custom glob. We should use the same glob pattern for the filesystem scan. We can use `Bun.Glob` or a simple walk + extension check for `**/*.md`.
- **No partial re-index in SDK**: Adding files requires a full `update()`. This is fine — it's fast for unchanged files (hash check skips them). The UX shows an "applying…" state.
- **Pending changes UX**: If the user hits `esc` with pending changes, show a confirm prompt or just discard. Start simple: discard with no warning. We can add confirmation later.
