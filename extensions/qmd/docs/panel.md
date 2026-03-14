# QMD Panel

An interactive TUI dashboard for inspecting the QMD index state of the current repository.

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
| Indexed + fresh | `indexed ✓` | Summary, index stats, contexts |
| Indexed + stale | `indexed · N stale` | Summary, index stats, contexts, stale files |
| Indexed + unknown | `indexed · freshness ?` | Summary, index stats, contexts |
| Not indexed | `not indexed` | Repo root, init hint |
| Unavailable | `unavailable` | Error reason |
| Updating | `updating…` | Progress |

## Keyboard Shortcuts

| Key | Overview | Files tree | Updating |
|-----|----------|------------|----------|
| `esc`, `q` | Close panel | Back to overview | Cancel |
| `Ctrl+C` | Close panel | Close panel | Close panel |
| `Ctrl+Alt+Q` | Toggle panel | Toggle panel | Toggle panel |
| `u` | Trigger update | — | — |
| `i` | Start init (if not indexed) | — | — |
| `r` | Refresh snapshot | Refresh snapshot | — |
| `j/k`, `↑↓` | Scroll | Move cursor | — |
| `enter`, `l`, `→` | Open file tree | Toggle collapse/expand | — |
| `h`, `←` | — | Back to overview | — |
| `space` | — | Toggle file/dir inclusion | — |
| `a` | — | Apply pending changes | — |
| `g` / `G` | Top / bottom | Top / bottom | — |
| `PageUp/Down` | Page scroll | Page scroll | — |

## File Tree

The files view is a NERDTree-style collapsible tree built from a **filesystem scan** of all `.md` files (including dot-directories like `.pi/`), overlaid with indexed state from QMD.

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

### Toggle behavior
- `space` toggles a single file or all files in a directory
- Directory toggle: if any descendant is effectively included → remove all; otherwise add all
- Changes are batched in `pending_adds`/`pending_removes` — not applied immediately
- `a` applies all pending changes (deactivates removes, indexes adds, embeds)
- Toggling back to original state clears the pending entry (no-op on apply)

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
- `docs` in the overview/index section is the **bound collection's document count** (current repo), not the global QMD total across all collections.
- Files view badge (`indexed/total`) compares currently indexed markdown paths vs markdown files discovered in this repo.

## Non-TUI Fallback

When `ctx.hasUI` is false, `/qmd` and `/qp` print a plain-text summary via `build_plain_text_summary()` instead of opening the panel.
