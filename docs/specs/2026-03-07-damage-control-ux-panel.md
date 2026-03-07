# Damage Control UX Follow-up — Minimal Footer + Panel Command

Status: Draft
Related: `extensions/damage-control/`
Date: 2026-03-07

## 1. Problem Statement

The current damage-control extension is functionally correct, but operator UX is noisy for day-to-day work:

- Footer status currently shows long rule-count text.
- There is no dedicated command/panel to inspect damage-control state and history.
- Violation log visibility is buried in session internals, not first-class UX.

Desired state:
- Footer becomes minimal using a single Unicode shield icon (`⛨`) with stateful color.
- `/damage-control` command opens a panel/modal with current state + runtime logs.
- A keyboard shortcut toggles the same panel quickly.
- Users can tell when there are unseen events worth checking via icon color.

## 2. Goals and Non-Goals

### 2.1 Goals

- Replace verbose footer text with a compact Unicode shield indicator (`⛨`).
- Encode state using color changes (normal/notify/incident) instead of extra footer text.
- Add `/damage-control` command to open a panel showing:
  - active rule counts by category
  - rule-source summary (bundled/global/project)
  - recent damage-control log entries from current session branch
- Add shortcut to toggle/open panel without typing command.
- Reset unread/new-activity indicator when panel is viewed.

### 2.2 Non-Goals

- No persistence to a separate `.pi/` log file (session entries remain source of truth).
- No heavy analytics dashboard (latency, charts, per-rule trend history) in v1 UX pass.
- No changes to rule evaluation semantics (this is UX-only follow-up).

## 3. System Context

Primary modules to change:

- `extensions/damage-control/index.ts`
- `extensions/damage-control/README.md`
- (optional split) new UI helper:
  - `extensions/damage-control/panel.ts`
  - `extensions/damage-control/logs.ts`

Extension currently already appends `damage-control-log` custom entries; this pass adds display and interaction on top.

## 4. Domain Model

### 4.1 In-memory UX State

Add internal state:

```ts
interface DamageControlUiState {
  unread_count: number;
  panel_open: boolean;
  last_opened_at: string | null;
}
```

Notes:
- `unread_count` increments on each new actionable event (`blocked`, `blocked_by_user`, `confirmed_by_user`).
- `unread_count` resets to `0` when panel opens.
- Persistence across restarts is not required in this phase.

### 4.2 Panel Row Model

```ts
interface DamageControlPanelRow {
  timestamp: string;
  action: "blocked" | "blocked_by_user" | "confirmed_by_user" | "allowed";
  tool_name: string;
  reason: string;
  rule_type: "bash_pattern" | "zero_access" | "read_only" | "no_delete";
  rule_source: "bundled" | "global" | "project";
}
```

Rows are hydrated from `damage-control-log` entries in `ctx.sessionManager.getBranch()`.

## 5. Detailed Design

### 5.1 Footer: Minimal Shield + Color State

Replace current verbose status text with a single icon-only glyph:

- icon glyph (all states): `⛨`
- healthy/active state: `⛨` in success/green color
- unread/new activity state: `⛨` in warning/amber color
- recent block/incident state: `⛨` in danger/red color

Implementation guidance:
- keep one status key: `damage-control`
- avoid rule counts or extra symbols in footer (moved to panel)
- drive all state signaling via color changes on `⛨`

### 5.2 `/damage-control` Command

Register new command:

- `/damage-control`
- aliases (optional): `/dc`

Behavior:
1. Build runtime summary from active rules in memory.
2. Read latest `damage-control-log` entries from current branch.
3. Open overlay/panel via `ctx.ui.custom(...)`.
4. On open, mark unread as seen and refresh footer.

Panel sections:
- Header: “Damage Control” + active icon state
- Rule summary:
  - bash patterns count
  - zero-access count
  - read-only count
  - no-delete count
  - loaded source labels
- Recent activity list (latest first, e.g., last 20)
  - timestamp, action, tool, short reason, source
- Footer hints: close key + refresh key (if implemented)

### 5.3 Shortcut Toggle

Register a shortcut to open/toggle the panel.

Recommended default:
- `Ctrl+Alt+D` (low collision risk with common defaults)

Behavior:
- if panel closed: open panel
- if panel open: close panel

### 5.4 Log Sourcing Strategy

Read logs directly from session branch entries:
- filter `custom` entries with `customType === "damage-control-log"`
- map to panel row model
- cap to recent N (default 50)

Benefits:
- no extra files
- naturally session-scoped
- compatible with existing audit implementation

### 5.5 Notification/Unread Policy

Increment unread count on:
- hard block
- ask denied
- ask approved

Do not increment on:
- session startup messages
- normal allow path with no policy event

Reset unread count when panel opens.

Footer color mapping policy:
- `success` (green): no unread events and no active incident flag
- `warning` (amber): unread events pending
- `danger` (red): latest event is a block/deny incident (until viewed or timeout policy clears)

## 6. Error Handling and Failure Modes

### `panel_render_error`
- If panel UI fails, fallback to `ctx.ui.notify()` summary text.

### `log_entry_shape_mismatch`
- If a malformed custom entry is encountered, skip it and continue rendering remaining rows.

### `shortcut_conflict`
- If keybinding conflicts in user setup, command remains canonical fallback (`/damage-control`).

## 7. Security and Safety Considerations

- Do not expose full unbounded command payloads in panel rows.
- Use truncated/sanitized reason/input previews to avoid accidental sensitive leakage.
- Keep policy enforcement independent of UI availability; panel is observability only.

## 8. Testing Strategy

### 8.1 Unit/Logic Validation

- unread counter increments/resets correctly
- branch log extraction returns expected rows and skips malformed entries
- footer state mapping (`healthy` / `notify` / `incident`) renders `⛨` with expected colors

### 8.2 Manual Validation

- Trigger a blocked command, confirm footer `⛨` turns red/incident.
- Trigger a non-blocking confirmation event, confirm footer `⛨` turns amber/notify.
- Run `/damage-control`, verify:
  - counts are shown
  - recent log appears
  - unread marker clears
- Trigger an `ask` rule and approve/deny; verify both outcomes appear in panel.
- Test shortcut opens panel.

## 9. Implementation Checklist

- [ ] Add command registration for `/damage-control`.
- [ ] Add shortcut registration (recommended `Ctrl+Alt+D`).
- [ ] Implement panel renderer (overlay/custom UI).
- [ ] Add branch log extraction helper for `damage-control-log` entries.
- [ ] Add in-memory unread state and footer color-state updates.
- [ ] Replace verbose footer summary with `⛨` icon-only indicator.
- [ ] Update README with new command + shortcut + UX behavior.
- [ ] Run `bun run check`.

## 10. Open Questions

1. **Shortcut key final choice**
   - Recommendation: `Ctrl+Alt+D`.

2. **Color token mapping**
   - Should we lock to `success` / `warning` / `error` theme tokens, or use custom semantic tokens for finer palette control?
   - Recommendation: start with existing theme semantic tokens for compatibility.

3. **Panel depth in v1**
   - simple list-only vs selectable detail rows.
   - Recommendation: list-only first, add row drill-down later if needed.
