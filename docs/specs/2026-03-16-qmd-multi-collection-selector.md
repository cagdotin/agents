# QMD multi-collection selector and cross-collection detail view

Status: Draft  
Date: 2026-03-16  
Execution plan: [[docs/exec-plans/active/2026-03-16-qmd-multi-collection-selector]]

## 1. Problem statement

The QMD panel currently behaves as a **repo-local dashboard**: it only shows data for the collection bound to the current repository (`ctx.cwd`). This is great for focused work, but it underuses QMD’s global store model.

Desired behavior:
- `/qmd` still defaults to the current repo’s bound collection (least surprise).
- Users can open a selector view and switch the panel’s active collection.
- After switching, users can inspect other collections in detail from the same panel session.

This turns the panel into a proper TUI wrapper over the QMD SDK while preserving current repo-first ergonomics.

## 2. Goals and non-goals

### 2.1 Goals

- Add a collection selection UX (page/section/popup-style view) inside the existing QMD panel.
- Preserve default behavior: panel opens focused on current repo binding when available.
- Allow switching “current selection” to any available collection in the QMD store.
- Show rich details for selected collection (path, pattern, doc count, contexts, indexed paths).
- Keep repo-scoped behavior for destructive operations unless explicitly enabled later.
- Keep panel architecture aligned with Unix and deep-module principles.

### 2.2 Non-goals

- No cross-repo write operations in this phase (no context editing, no file toggling for external collections).
- No persistent “last selected collection” across sessions (selection is panel-session local).
- No changes to `/qmd update` semantics (remains current-repo scoped command behavior).
- No new always-on search tool in extension.

## 3. System context

Relevant modules:
- `extensions/qmd/extension/command.ts` — panel lifecycle and command wiring.
- `extensions/qmd/ui/panel.ts` — view state, keyboard behavior, rendering.
- `extensions/qmd/ui/data.ts` — snapshot builder (data contract for UI).
- `extensions/qmd/ui/plain-text.ts` — non-TUI fallback output.
- `extensions/qmd/core/qmd-store.ts` — SDK wrapper for collection/status/context access.
- `extensions/qmd/domain/repo-binding.ts` — current repo binding detection.

Current invariant to preserve:
- QMD store is source of truth for collections/contexts.
- `.pi/qmd.json` is only binding/freshness marker for *this* repo.

## 4. Domain model

Add explicit selection concepts to the snapshot contract:

```ts
type QmdSelectionScope = "bound" | "external" | "none";

interface QmdCollectionSummary {
  key: string;
  repo_root: string;
  glob_pattern: string;
  doc_count: number;
  is_bound_collection: boolean;
}

interface QmdSelectedCollection {
  key: string | null;
  scope: QmdSelectionScope;
  repo_root: string | null;
  glob_pattern: string | null;
  doc_count: number;
  contexts: Array<{ path: string; annotation: string }>;
  indexed_qmd_paths: string[];
  indexed_fs_paths: string[]; // bound collection only
  filesystem_paths: string[]; // bound collection only
  supports_file_toggling: boolean;
  supports_update_action: boolean;
}
```

`QmdPanelSnapshot` is extended to include:
- `bound_collection_key`
- `selected_collection`
- `collections`

This keeps policy encoded in data (Rule of Representation).

## 5. Detailed design

### 5.1 Snapshot builder and store access

Extend `build_qmd_panel_snapshot()` to accept an optional selected key:

```ts
build_qmd_panel_snapshot(cwd, binding, freshness, selected_collection_key?)
```

Behavior:
1. Resolve collection catalog from QMD store (`list_collections`, `get_status` as needed).
2. Determine selected key:
   - if explicit key exists in catalog -> use it
   - else if repo-bound collection exists -> use bound
   - else -> first catalog entry or `null`
3. Build selected detail block:
   - contexts filtered by selected key
   - indexed paths for selected key
   - filesystem scan only when selected == bound collection
4. Derive capability flags:
   - `supports_file_toggling = selected == bound`
   - `supports_update_action = selected == bound` (phase 1 policy)

### 5.2 Panel interaction model

Add a third navigational view:
- `overview` (existing)
- `files` (existing; read/write only for bound)
- `collections` (new selector view)

Proposed keys:
- `c` in overview/files -> open collection selector
- `j/k`, `g/G`, `PageUp/Down` -> navigate selector rows
- `enter` -> set selected collection and return to overview
- `esc`/`q` -> back/close according to current view

Overview header updates:
- always show selected collection key prominently
- when selected != bound, show secondary marker: `bound: <repo-key>`
- show capability hint for external selection (`read-only selection`)

### 5.3 Files/details behavior

- For bound selection: keep current tree + toggle/apply behavior.
- For external selection: files view becomes read-only indexed-path browser.
  - no `space`/`a` actions
  - footer hints adapt automatically

This avoids surprising cross-repo mutations and aligns with least surprise.

### 5.4 Command/runtime behavior

- `/qmd` open still defaults to bound collection for current repo.
- `/qmd status`, `/qmd update`, `/qmd init` semantics unchanged.
- Footer/runtime prompt injection remains based on **repo binding**, not selector choice.

### 5.5 Non-TUI fallback

`build_plain_text_summary()` gains:
- selected collection key
- bound collection key
- compact collection list (with markers for selected/bound)

## 6. Error handling and failure modes

- Selected key removed between refreshes -> fallback to bound/first available and show warning line.
- Store unavailable -> existing unavailable state.
- Empty catalog + unbound repo -> show `no collections` state with init guidance.
- External selection action attempt (update/toggle) -> UI-disabled path, no mutation.

## 7. Security and safety considerations

- No write operations against non-bound collections in phase 1.
- No marker mutation except current repo’s marker under existing update flow.
- No path joins into external repos for file toggling.

## 8. Testing strategy

### 8.1 Unit tests

Update/add tests in:
- `extensions/qmd/__tests__/ui/data.test.ts`

Cases:
- defaults to bound collection when indexed.
- explicit selected collection uses external details.
- missing selected key falls back deterministically.
- external selection disables file toggle/update flags.
- plain-text summary includes selected/bound markers.

### 8.2 Integration/manual checks

Manual panel verification:
1. `/qmd` opens on bound collection.
2. `c` opens selector list.
3. select external collection, overview updates.
4. `enter` on files for external is read-only.
5. switching back to bound re-enables toggles/update.

## 9. Implementation checklist

- [ ] Extend snapshot types for collection catalog + selected detail.
- [ ] Add selected-key parameter to snapshot builder.
- [ ] Add `collections` view and keybindings in panel.
- [ ] Add read-only external files mode.
- [ ] Keep write actions bound-only and visually disabled otherwise.
- [ ] Update plain-text fallback.
- [ ] Update docs (`extensions/qmd/docs/panel.md`, `extensions/qmd/README.md`).
- [ ] Add/update tests for selection behavior.

## 10. Open questions

1. Should panel remember last manually selected collection across panel re-open in the same session, or always reset to bound? (spec currently: always reset to bound).
2. Should `u` eventually update selected external collections (with confirmation), or remain bound-only permanently?
3. Do we want fuzzy filtering in collection selector immediately, or keep v1 navigation-only (`j/k`)?

## 11. Design-principle alignment

### Unix philosophy

- **Modularity**: keep selection data modeling in `ui/data.ts`; keep rendering in `ui/panel.ts`; keep command policy in `extension/command.ts`.
- **Separation**: selector state is UI mechanism; repo-binding policy remains in domain/extension layers.
- **Least surprise**: default selection is always current repo binding.
- **Repair**: invalid/stale selection falls back deterministically with visible messaging.

### Deep modules / AI-ready codebase

- Keep one deep snapshot contract (`QmdPanelSnapshot`) that hides SDK quirks and selection fallback logic.
- Preserve progressive disclosure: overview first, selector/file detail only when requested.
- Guard boundaries with explicit capability flags, not scattered conditional logic.
