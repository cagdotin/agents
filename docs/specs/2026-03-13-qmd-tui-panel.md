# QMD TUI Panel — Index Dashboard

Status: draft
Date: 2026-03-13
Track: agent-memory

## 1. Problem Statement

The QMD extension manages repo-level knowledge indexing, but the only way to inspect its state is `/qmd status` — a plain-text dump with no interactivity. There is no way to browse indexed files, see stale content at a glance, trigger an update without typing a command, or drill into path contexts. The session-stats extension proves that a well-designed TUI panel turns passive data into an actionable dashboard.

Desired end state:
- A TUI panel shows the full QMD state for the current repo in one view.
- Keyboard shortcuts trigger real operations (update, init) without leaving the panel.
- The panel follows the same UX conventions as session-stats — users learn one interaction model.
- Data gathering is cleanly separated from rendering; both are separated from Pi wiring.

## 2. Design Principles

### Unix philosophy (applied)

| Rule | Application |
|------|-------------|
| **Modularity** | Data snapshot, panel rendering, and command registration are three separate modules with clean interfaces. |
| **Separation** | Policy (what to show, when to show it) lives in the data layer. Mechanism (how to render) lives in the panel. Pi wiring lives in the extension layer. |
| **Composition** | The data snapshot is a plain typed object. The same snapshot serves the panel, the plain-text fallback, and future consumers. |
| **Representation** | Fold all QMD state into one `QmdPanelSnapshot` type. Panel rendering logic becomes dumb and robust — it just reads fields. |
| **Transparency** | Show real data: file counts, stale paths, freshness commit, index timestamps. No abstraction layers between user and truth. |
| **Silence** | Non-indexed repos get a minimal "not indexed" view with an `i` shortcut, not an empty dashboard. |
| **Simplicity** | One panel, two views (overview and file browser). No tabs, no modes beyond list → detail. |
| **Least Surprise** | Same keys as session-stats: `j/k` scroll, `enter` detail, `esc`/`q` close, `r` refresh. New: `u` update, `i` init. |
| **Extensibility** | The snapshot type and section renderer pattern are designed to accept new sections without rewriting the panel. |

### Design direction (TUI aesthetic)

**Tone: Industrial-utilitarian.** Dense information, clean typography, monospace grid discipline. The panel is a control dashboard, not a decoration. Every line has a job.

- **Typography**: Unicode box-drawing for framing (`╭╮╰╯│─`). Section headers use `──` rails with inline labels. Status uses compact symbols (`✓`, `·`, `▸`).
- **Color**: Accent color for actionable values (counts, keys, the selected item). Muted for labels. Dim for decoration and separators. Error color only for real problems.
- **Spatial composition**: Fixed-width panel (80 cols), vertically scrollable. Header is always visible. Footer hints are always visible. Content fills the space between.
- **Information density**: Show counts, paths, and timestamps — not prose. If a number is zero, say `0`, don't say "none found". If a section is empty, collapse it to one line.

## 3. Goals and Non-Goals

### Goals

- Provide a TUI panel accessible via `/qmd` (no args), `/qp` alias, and `Ctrl+Alt+Q` shortcut.
- Show: binding status, freshness, index stats, path contexts, and stale files.
- Provide detail view for browsing all indexed files grouped by directory.
- `u` key triggers `/qmd update` from the panel and refreshes when done.
- `i` key starts `/qmd init` when repo is not indexed (closes panel, starts init flow).
- Plain-text fallback when `ctx.hasUI` is false.
- Data layer is a pure function that returns a typed snapshot — no Pi imports, no TUI imports.

### Non-Goals

- Search from the panel (search goes through `qmd query` via bash — this is the extension's design).
- Auto-opening the panel on session start.
- Live-updating file watchers or poll loops.
- Context editing from the panel (contexts are managed via `/qmd init`).

## 4. Architecture

### Module placement

```
extensions/qmd/
├── core/              # (existing — types, store, errors)
├── domain/            # (existing — binding, freshness, onboarding)
├── extension/         # (existing — runtime, command, tool)
│   └── command.ts     # MODIFIED: register panel command + shortcut
├── ui/                # NEW — all presentation
│   ├── constants.ts   # panel width, shortcut, icon, command names
│   ├── data.ts        # snapshot builder (pure data, no Pi, no TUI)
│   ├── panel.ts       # QmdPanel class (TUI overlay component)
│   └── plain-text.ts  # plain-text summary builder (non-TUI fallback)
├── docs/
│   └── panel.md       # NEW — panel behavior docs
└── __tests__/
    └── ui/
        └── data.test.ts
```

### Dependency direction

```
extension/command.ts → ui/panel.ts → ui/data.ts → core/types.ts
                     → ui/plain-text.ts → ui/data.ts
                     → ui/constants.ts
```

**No upward imports.** `ui/data.ts` depends only on `core/types.ts`. `ui/panel.ts` depends on `ui/data.ts` and `ui/constants.ts`. `extension/command.ts` is the only file that touches Pi APIs.

### Data snapshot type

```ts
interface QmdPanelSnapshot {
  // Binding
  binding_status: "indexed" | "not_indexed" | "unavailable";
  repo_root: string | null;
  collection_key: string | null;
  binding_source: "marker" | "store" | null;
  repair_warning: string | null;

  // Freshness
  freshness_status: "fresh" | "stale" | "unknown" | null;
  stale_paths: string[];
  stale_count: number;

  // Index stats
  total_documents: number;
  needs_embedding: number;
  has_vector_index: boolean;
  glob_pattern: string | null;
  last_indexed_at: string | null;
  last_indexed_commit: string | null;

  // Contexts
  contexts: Array<{ path: string; annotation: string }>;

  // All indexed file paths (for detail view)
  indexed_paths: string[];
}
```

This is a **flat, serializable** struct. No SDK objects, no promises, no callbacks. The panel renders it without knowing where it came from.

### Snapshot builder

```ts
// ui/data.ts — pure function, no Pi or TUI imports
async function build_qmd_panel_snapshot(
  cwd: string,
  binding: RepoBindingResult,
  freshness: FreshnessResult | undefined,
): Promise<QmdPanelSnapshot>
```

It calls into `core/qmd-store.ts` for index stats, contexts, and active paths. It normalizes everything into the flat snapshot.

### Panel actions

The panel needs to trigger two operations: **update** and **init**. These are callbacks injected by `extension/command.ts`, not imported by the panel:

```ts
interface QmdPanelCallbacks {
  get_snapshot: () => Promise<QmdPanelSnapshot>;
  on_update: () => Promise<void>;
  on_init: () => void;
  on_close: () => void;
}
```

This keeps the panel free of Pi/extension logic. The extension layer decides what "update" means.

## 5. Panel Layout

### Main view — Overview

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ◈ QMD Index                                                    indexed ✓   │
│                                                                              │
│  agents  ·  **/*.md  ·  142 docs  ·  fresh ✓                                │
│  last indexed: 2h ago  ·  abc1234                                            │
│                                                                              │
│  ── Index ───────────────────────────────────────────── 0 pending embed ──   │
│                                                                              │
│    documents       142                                                       │
│    vector index      ✓                                                       │
│    needs embed       0                                                       │
│                                                                              │
│  ── Contexts (4) ────────────────────────────────────────────────────────    │
│                                                                              │
│  ▸ docs/           Architecture docs, design decisions, specs                │
│    extensions/     Pi extensions — all follow the same structure              │
│    skills/         Agent skills with SKILL.md entrypoints                    │
│    .pi/            Pi config, tracks, expertise, todos                       │
│                                                                              │
│  ── Stale (3) ──────────────────────────────────────────── u to update ──   │
│                                                                              │
│    docs/ARCHITECTURE.md                                                      │
│    extensions/qmd/README.md                                                  │
│    skills/qmd/SKILL.md                                                       │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  esc close  ·  u update  ·  r refresh  ·  enter files  ·  j/k scroll        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### Main view — Not indexed

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ◈ QMD Index                                                not indexed     │
│                                                                              │
│  /Users/cgn/git/0xcgn/agents                                                 │
│  suggested key: p_L1VzZXJzL2Nnbi9naXQvMHhjZ24vYWdlbnRz                      │
│                                                                              │
│  Run /qmd init to onboard this repository.                                   │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  esc close  ·  i init  ·  r refresh                                          │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### Main view — Updating (in-panel progress)

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ◈ QMD Index                                                  updating…     │
│                                                                              │
│  agents  ·  **/*.md  ·  142 docs                                             │
│  indexing: docs/ARCHITECTURE.md (23/142)                                     │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  esc cancel                                                                  │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### Detail view — Indexed Files

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ◈ QMD Index › Files                                          142 files     │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  docs/ (28)                                                                  │
│    │ ARCHITECTURE.md                                                         │
│    │ QUALITY.md                                                              │
│    │ CONTRIBUTING-DOCS.md                                                    │
│    │ …                                                                       │
│                                                                              │
│  extensions/ (45)                                                            │
│    │ qmd/README.md                                                           │
│    │ qmd/docs/architecture.md                                                │
│    │ session-stats/README.md                                                 │
│    │ …                                                                       │
│                                                                              │
│  skills/ (32)                                                                │
│    │ qmd/SKILL.md                                                            │
│    │ github/SKILL.md                                                         │
│    │ …                                                                       │
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  esc back  ·  j/k scroll  ·  r refresh                          1–24/142    │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## 6. Keyboard Interactions

| Key | Main view | Detail view |
|-----|-----------|-------------|
| `esc`, `q` | Close panel | Back to main |
| `Ctrl+Alt+Q` | Toggle panel | Toggle panel |
| `u` | Trigger update | — |
| `i` | Start init (if not indexed) | — |
| `r` | Refresh snapshot | Refresh snapshot |
| `j/k`, `↑↓` | Scroll | Scroll |
| `enter`, `l`, `→` | Open file detail | — |
| `h`, `←` | — | Back to main |
| `g` / `G` | Top / bottom | Top / bottom |
| `PageUp/Down` | Page scroll | Page scroll |

## 7. Panel States

| State | Header badge | Sections shown | Available actions |
|-------|-------------|----------------|-------------------|
| Indexed + fresh | `indexed ✓` | summary, index, contexts | `u`, `r`, `enter` |
| Indexed + stale | `indexed · N stale` | summary, index, contexts, stale files | `u`, `r`, `enter` |
| Indexed + unknown | `indexed · freshness ?` | summary, index, contexts | `u`, `r`, `enter` |
| Not indexed | `not indexed` | repo root, suggested key | `i`, `r` |
| Unavailable | `unavailable` | error reason | `r` |
| Updating | `updating…` | progress line | `esc` cancel |

## 8. Store additions

`core/qmd-store.ts` needs two new helpers to provide data for the snapshot:

```ts
// Get all active document paths for a collection
async function get_active_document_paths(collection_key: string): Promise<string[]>

// Get index health info
async function get_index_health(): Promise<{ needs_embedding: number; total_docs: number; days_stale: number | null }>
```

Both are thin wrappers over existing SDK methods (`store.getActiveDocumentPaths()` and `store.getIndexHealth()`).

## 9. Interaction with existing code

### What changes

| File | Change |
|------|--------|
| `extension/command.ts` | Add panel open/toggle logic, register `/qp` alias, register `Ctrl+Alt+Q` shortcut |
| `core/qmd-store.ts` | Add `get_active_document_paths()` and `get_index_health()` |
| `index.ts` | Wire panel state into extension lifecycle |
| `README.md` | Document panel, command alias, shortcut |

### What does not change

| File | Why |
|------|-----|
| `core/types.ts` | Snapshot type lives in `ui/data.ts`, not core |
| `core/errors.ts` | No new error types needed |
| `domain/repo-binding.ts` | Already provides `RepoBindingResult` |
| `domain/freshness.ts` | Already provides `FreshnessResult` |
| `domain/onboarding.ts` | Init workflow unchanged |
| `extension/runtime.ts` | Footer and prompt injection unchanged |
| `extension/tool.ts` | Init tool unchanged |

## 10. Testing Strategy

### Unit tests

- `__tests__/ui/data.test.ts`: test `build_qmd_panel_snapshot()` with mock binding/freshness/store data.
  - indexed + fresh → correct snapshot fields
  - indexed + stale → stale paths populated
  - not indexed → null fields, correct status
  - unavailable → error reason captured
  - contexts and indexed paths populated from mock store calls
  - empty collection → zero counts, empty arrays

### Integration tests

Not required for v1. Panel rendering is manual validation. The data layer is the testable boundary.

## 11. Error Handling

- **Panel render failure**: catch, close panel, fall back to `ctx.ui.notify()` with plain-text summary.
- **Store unavailable during snapshot**: snapshot returns `binding_status: "unavailable"`, panel renders the unavailable view.
- **Update failure**: notify with error message, restore panel to pre-update state.
- **Snapshot build timeout**: not expected (all operations are local), but the panel should not block indefinitely — `u` update shows progress.

## 12. Open Questions

1. **Update progress granularity**: QMD SDK `update_collection()` supports `on_progress`. Worth showing file-by-file progress, or just a spinner?
2. **Panel width**: 80 cols matches session-stats. Is this wide enough for long file paths?
3. **Contexts section**: should contexts be selectable/expandable, or just displayed?
