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

| Key | Overview | Files tree |
|-----|----------|------------|
| `esc`, `q` | Close panel | Back to overview |
| `Ctrl+Alt+Q` | Toggle panel | Toggle panel |
| `u` | Trigger update | — |
| `i` | Start init (if not indexed) | — |
| `r` | Refresh snapshot | Refresh snapshot |
| `j/k`, `↑↓` | Scroll | Move cursor |
| `enter`, `l`, `→` | Open file tree | Toggle collapse/expand |
| `h`, `←` | — | Back to overview |
| `g` / `G` | Top / bottom | Top / bottom |
| `PageUp/Down` | Page scroll | Page scroll |

## File Tree

The files view is a NERDTree-style collapsible tree:
- Directories show `▸` (collapsed) or `▾` (expanded) with file counts
- Single-child directory chains are collapsed (e.g. `docs/exec-plans/active`)
- Directories start collapsed for easy top-level navigation
- `enter` toggles collapse/expand on directories
- Tree lines (`├──`, `└──`, `│`) show hierarchy

## Data Flow

```
detect_repo_binding() + check_freshness()
        ↓
build_qmd_panel_snapshot()  →  QmdPanelSnapshot (flat struct)
        ↓
QmdPanel.render()  →  framed TUI lines
```

The snapshot is a flat, serializable struct with no SDK objects. The panel renders it without knowing where the data came from. Actions (update, init) are injected as callbacks.

## Non-TUI Fallback

When `ctx.hasUI` is false, `/qmd` and `/qp` print a plain-text summary via `build_plain_text_summary()` instead of opening the panel.
