# QMD Panel

An interactive TUI dashboard for inspecting the QMD index state of the current repository, with an in-panel collection selector for cross-collection browsing.

## Access

| Method | Description |
|--------|-------------|
| `/qmd` | Open the panel (no args) |
| `/qp` | Alias — opens the panel |
| `Ctrl+Alt+Q` | Toggle the panel |
| `/qmd status` | Print plain-text status (unchanged) |
| `/qmd update` | Run update from command line (unchanged) |
| `/qmd init` | Start onboarding flow (unchanged) |

## Panel States

| State | Badge | What's shown |
|-------|-------|-------------|
| Bound + fresh | `indexed ✓` | Selected bound collection summary, index stats, contexts |
| Bound + stale | `indexed · N stale` | Bound summary + stale file section |
| External selected | `external · readonly` | Selected external collection summary + readonly tag |
| Not indexed + no selection | `not indexed` | Repo root, init hint, collection hint (if available) |
| Collections view | `Collections` | All known collections with selected/bound tags |
| Unavailable | `unavailable` | Error reason |
| Updating/Applying | `updating…` / `applying…` | Progress |

## Collection selector view

Press `c` from overview or files to open the selector.

- Shows all known collections from the QMD store
- Marks the panel-active entry with `[selected]`
- Marks the current repo binding with `[bound]`
- Uses a low-density list (key + tags) plus a dedicated details block for the highlighted row
- Shows a scope strip (`[bound]` / `[external readonly]`) for orientation
- Press `/` to enter filter typing mode (`enter` to finish, `ctrl+u` to clear)
- `enter` (outside typing mode) switches the active collection and returns to overview
- External selections are intentionally readonly in this phase

## Keyboard Shortcuts

| Key | Overview | Collections | Files tree | Updating |
|-----|----------|-------------|------------|----------|
| `esc`, `q` | Close panel | Back to overview | Back to overview | Cancel |
| `Ctrl+C` | Close panel | Close panel | Close panel | Close panel |
| `Ctrl+Alt+Q` | Toggle panel | Toggle panel | Toggle panel | Toggle panel |
| `c` | Open collections view | — | Open collections view | — |
| `u` | Trigger update (bound only) | — | — | — |
| `i` | Start init (if repo not indexed) | — | — | — |
| `r` | Refresh snapshot | Refresh snapshot | Refresh snapshot | — |
| `/` | — | Enter filter typing mode | — | — |
| `j/k`, `↑↓` | Scroll | Move cursor | Move cursor | — |
| `enter`, `l`, `→` | Open file tree | Select collection (or finish filter typing) | Toggle collapse/expand | — |
| `h`, `←` | — | Back to overview / exit filter mode | Back to overview | — |
| `backspace` | — | Delete filter character (typing mode) | — | — |
| `ctrl+u` | — | Clear filter (typing mode) | — | — |
| `space` | — | — | Toggle file/dir inclusion (bound only) | — |
| `a` | — | — | Apply pending changes (bound only) | — |
| `g` / `G` | Top / bottom | Top / bottom | Top / bottom | — |
| `PageUp/Down` | Page scroll | Page scroll | Page scroll | — |

## File Tree

The files view is a NERDTree-style collapsible tree.

- **Bound selection**: built from a filesystem scan of all `.md` files (including dot-directories like `.pi/`), overlaid with indexed state from QMD.
- **External selection**: built from indexed QMD paths only and shown in **readonly** mode.

### Structure
- Directories show `▸` (collapsed) or `▾` (expanded) with file counts
- Single-child directory chains are collapsed (e.g. `docs/exec-plans/active`)
- Directories start collapsed for easy top-level navigation
- `enter` toggles collapse/expand on directories
- Tree lines (`├──`, `└──`, `│`) show hierarchy

### Index toggle indicators

| Indicator | Meaning |
|-----------|---------|
| `●` | Indexed, no pending change |
| `○` | Not indexed, no pending change |
| `◉` | Pending add (will be indexed on apply) |
| `◎` | Pending remove (will be deactivated on apply) |

Directories show aggregate indicators: `●` (all descendants indexed), `◐` (some), `○` (none).

### Toggle behavior (bound selection only)
- `space` toggles a single file or all files in a directory
- Directory toggle: if any descendant is effectively included → remove all; otherwise add all
- Changes are batched in `pending_adds`/`pending_removes` — not applied immediately
- `a` applies all pending changes (deactivates removes, indexes adds, embeds)
- Toggling back to original state clears the pending entry (no-op on apply)
- For external selections, toggles are disabled and the panel displays `[readonly]`

### Dot-path file persistence
QMD's reindexer skips dot-prefixed path segments. Files under `.pi/`, `.github/`, etc. are indexed via direct store insertion and persisted in the marker's `extra_paths` field. After every `update_collection()`, `extra_paths` are re-indexed automatically.

## Data Flow

```
detect_repo_binding() + check_freshness()
        ↓
build_qmd_panel_snapshot()  →  QmdPanelSnapshot (flat struct)
        ↓
QmdPanel.render()  →  framed TUI lines
```

The snapshot is a flat, serializable struct with no SDK objects. The panel renders it without knowing where the data came from. Actions (update, init) are injected as callbacks.

Count semantics:
- `docs` in overview is the **selected collection's** document count.
- `needs embed` remains global QMD index health.
- Files view badge (`indexed/total`) uses filesystem paths for bound selection, and indexed QMD paths for external readonly selection.

## Non-TUI Fallback

When `ctx.hasUI` is false, `/qmd` and `/qp` print a plain-text summary via `build_plain_text_summary()` instead of opening the panel.
