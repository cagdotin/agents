# Damage Control Panel — Event Navigation & Detail View

Status: Draft
Date: 2026-03-07
Related: `extensions/damage-control/panel.ts`, `extensions/damage-control/types.ts`

## 1. Problem Statement

The current damage control panel shows a compact overview of policy events (timestamp, badge, tool, reason preview) but offers no way to:

1. **Select** a specific event to see its full details (reason, rule type, rule source, input preview, matched pattern).
2. **Navigate** events with keyboard (vim keys or arrows) to focus individual rows.
3. **Drill into** an event detail view that shows the complete context of what the agent tried to do and why it was blocked.
4. **Scroll** within a detail view when its content exceeds the modal height.
5. **Go back** from detail view to the overview without closing the entire modal.

The current UX only supports scrolling the event list and pressing `esc` to close. There's no concept of a "selected event" or a multi-screen navigation flow within the panel.

## 2. Goals and Non-Goals

### 2.1 Goals

- Add a **focused/selected row** concept to the event list with visual highlight.
- Support **vim-style navigation** (`j`/`k`) and **arrow keys** (`↑`/`↓`) to move selection up/down.
- Support **Enter** to open the selected event's detail view.
- Build an **event detail view** that shows all available fields from `DamageControlPanelRow`:
  - action badge + label
  - tool name
  - timestamp (full ISO)
  - rule type (e.g., `bash_pattern`, `read_only`, `zero_access`, `no_delete`)
  - rule source (`bundled`, `global`, `project`)
  - full reason (unwrapped, multi-line if needed)
  - full input preview (unwrapped, multi-line if needed)
- Make the detail view **independently scrollable** when its content exceeds the available modal height.
- Implement **layered escape behavior**:
  - In detail view: `esc` returns to the overview list (does NOT close the modal).
  - In overview list: `esc` closes the modal entirely.
- Show contextual **key hints** in the footer reflecting the active view.
- Preserve all existing panel functionality (rule gauges, header, refresh, shortcut-key toggle).

### 2.2 Non-Goals

- No editing or dismissal of individual events from the panel.
- No filtering or search within the event list (future enhancement).
- No changes to the `DamageControlLogEntry` schema or data captured at log time.
- No persistence of panel state (selected index, scroll position) across panel opens.
- No horizontal scrolling (content wraps or truncates to fit modal width).

## 3. System Context

### Affected Modules

| Module | Change |
|---|---|
| `extensions/damage-control/panel.ts` | Primary — add selection state, detail view, layered input handling |
| `extensions/damage-control/types.ts` | No schema changes needed — existing `DamageControlPanelRow` already has all required fields |
| `extensions/damage-control/index.ts` | Minor — increase `describe_tool_input` truncation limit from 240 → 500 |
| `extensions/damage-control/logs.ts` | Minor — increase `to_panel_row` truncation limits for `reason` and `input_preview` |

### Key Constraints

- The panel renders via `ctx.ui.custom()` with `overlay: true` and returns `string[]` from its `render()` method — it is a **raw line renderer**, not a `Container`-based component tree.
- The panel manages its own `handleInput()` and scroll state. All navigation/selection/view-switching logic lives in the `DamageControlPanel` class.
- TUI `matchesKey()` is the canonical way to check key bindings.
- Each rendered line must not exceed the `width` parameter. Use `truncateToWidth()` and `visibleWidth()`.
- Theme styling via `theme.fg(color, text)` and `theme.bold()`.

## 4. Domain Model

### 4.1 Panel View State

```ts
type PanelView = "list" | "detail";

// Added to DamageControlPanel class:
private view: PanelView = "list";
private selected_index: number = 0;       // currently focused row in list
private detail_scroll_offset: number = 0; // scroll position within detail view
private detail_lines: string[] = [];      // pre-rendered detail content
private detail_view_height: number = 0;   // available lines for detail scrolling
```

### 4.2 No Type Changes

`DamageControlPanelRow` already carries all fields needed for the detail view:

- `timestamp` — full ISO string (currently truncated to `HH:MM:SS` in the list view)
- `action` — `"blocked"` | `"blocked_by_user"` | `"confirmed_by_user"` | `"allowed"`
- `tool_name` — tool that was called
- `reason` — why the rule matched (may be long, currently truncated)
- `rule_type` — violation category
- `rule_source` — which rule file matched
- `input_preview` — what the agent tried to pass (may be long, currently truncated at 180 chars in `logs.ts`)

## 5. Detailed Design

### 5.1 View States and Transitions

```
┌──────────────────────────┐
│       LIST VIEW          │
│  (selected row highlight)│
│                          │
│  j/↓  = select next      │
│  k/↑  = select previous  │
│  Enter = open detail     │
│  esc/q = close modal     │
└────────────┬─────────────┘
             │ Enter
             ▼
┌──────────────────────────┐
│       DETAIL VIEW        │
│  (full event info,       │
│   scrollable)            │
│                          │
│  j/↓  = scroll down      │
│  k/↑  = scroll up        │
│  PgDn = page down        │
│  PgUp = page up          │
│  esc  = back to list     │
│  q    = close modal      │
└──────────────────────────┘
```

### 5.2 List View — Selection Behavior

**Current behavior** (preserved): up/down scroll the viewport over the event list. There is no concept of a "selected" row.

**New behavior**: Replace viewport scrolling with cursor-style navigation. A single row is "selected" at any time, visually highlighted. Scrolling follows the cursor (auto-scroll to keep the selected row visible).

#### Navigation Keys

| Key | Action |
|---|---|
| `j` or `↓` | Move selection down by 1 |
| `k` or `↑` | Move selection up by 1 |
| `g` or `Home` | Jump to first event |
| `G` or `End` | Jump to last event |
| `Enter` | Open detail view for selected event |
| `esc` | Close the modal |
| `q` | Close the modal |
| `ctrl+c` | Close the modal (immediate, skips layering) |
| Shortcut key | Close the modal (toggle behavior) |
| `r` | Refresh event data |
| `Page Down` | Move selection down by viewport height |
| `Page Up` | Move selection up by viewport height |

#### Visual Highlight

The selected row gets a distinct visual treatment:

```
  ✕ bash  14:32:01  bundled  git reset --hard discards…   ← normal row (space prefix)
▸ ✕ bash  14:33:15  project  access to zero-access path…  ← selected row (▸ prefix)
  ✓ write 14:34:22  global   modification of read-only…   ← normal row (space prefix)
```

Implementation approach:
- Prefix selected row with `▸` (U+25B8) in accent color.
- Prefix non-selected rows with a single space (` `) to maintain alignment and prevent layout jumpiness. The `▸` glyph and space occupy the same visual width.
- Use `theme.fg("accent", "▸")` for the selected marker. No background highlighting — raw string line rendering makes bg unreliable across themes.

#### Auto-Scroll

When `selected_index` moves outside the visible scroll window:
- If selection goes below visible range: scroll down to show selected row at the bottom of the viewport.
- If selection goes above visible range: scroll up to show selected row at the top of the viewport.

### 5.3 Detail View — Layout

When the user presses Enter on a selected event, the panel switches to `view: "detail"`. The detail view replaces the event list area within the same modal frame (header and borders stay).

#### Detail Content Structure

```
╭──────────────────────────────────────────────────────╮
│ ⛨ Damage Control  bundled, project                   │
│ ──────────────────────────────────────────────────────│
│ ✕ Event Detail                                       │
│ ──────────────────────────────────────────────────────│
│                                                      │
│   Action     ✕ blocked                               │
│   Tool       bash                                    │
│   Time       2026-03-07T14:33:15.123Z                │
│   Rule Type  bash_pattern                            │
│   Source     bundled                                  │
│                                                      │
│ ──────────────────────────────────────────────────────│
│   Reason                                             │
│   git reset --hard discards uncommitted changes      │
│                                                      │
│ ──────────────────────────────────────────────────────│
│   Input                                              │
│   git reset --hard HEAD~3                            │
│                                                      │
│ ──────────────────────────────────────────────────────│
│   esc back  ↑↓/jk scroll                            │
╰──────────────────────────────────────────────────────╯
```

#### Detail Sections

1. **Title bar**: Action badge + "Event Detail" label.
2. **Metadata fields**: Key-value pairs for action, tool, timestamp, rule type, source — each on its own line with label in `muted` and value in `accent` or standard text.
3. **Reason section**: Divider + label + full reason text, word-wrapped to fit modal width.
4. **Input section**: Divider + label + full input preview, word-wrapped to fit modal width.
5. **Footer**: Key hints for the detail view.

#### Word Wrapping

Long reason and input preview strings must be word-wrapped to fit within `iw` (inner width). Use the `wrapTextWithAnsi()` utility from `@mariozechner/pi-tui` if the text has ANSI codes, or a simple word-break wrapper for plain text.

#### Scrolling in Detail View

The detail view content (everything between the title and footer) is scrollable:

| Key | Action |
|---|---|
| `j` or `↓` | Scroll down 1 line |
| `k` or `↑` | Scroll up 1 line |
| `Page Down` | Scroll down by viewport height |
| `Page Up` | Scroll up by viewport height |
| `g` or `Home` | Scroll to top |
| `G` or `End` | Scroll to bottom |
| `esc` | Return to list view |
| `q` | Return to list view (same as esc — layered dismissal) |
| `ctrl+c` | Close modal entirely (immediate) |

### 5.4 Escape Key Behavior — Layered Dismissal

This is the core UX improvement for modal navigation:

```
Detail View → esc → List View → esc → Modal Closed
```

Implementation in `handleInput()`:

```ts
if (matchesKey(key_data, "escape")) {
    if (this.view === "detail") {
        // Go back to list view, preserve selection
        this.view = "list";
        this.detail_scroll_offset = 0;
        this.tui.requestRender();
        return;
    }
    // In list view, close modal
    this.done();
    return;
}
```

Note: Both `q` and `esc` use layered dismissal — they go back one level. Only `ctrl+c` closes the modal immediately from any view.

### 5.5 Footer Key Hints

Footer hints change based on the active view:

**List view** (events exist):
```
  esc close  r refresh  j/k navigate  enter detail  ↑↓ 1-5/12
```

**List view** (no events):
```
  esc close  r refresh
```

**Detail view**:
```
  esc/q back  j/k scroll  1-5/12
```

Scroll position indicator (`1-5/12`) appears only when content is scrollable.

### 5.6 Rendering Architecture

The `render()` method dispatches to view-specific sub-renderers:

```ts
render(width: number): string[] {
    if (this.view === "detail") {
        return this.render_detail_view(width);
    }
    return this.render_list_view(width);
}
```

Both sub-renderers share the same framing logic (borders, header with icon + title + source label). They differ in the content area between header and footer.

#### render_list_view(width)

Same as current `render()` but with selection highlight on the focused row. The rule gauges, dividers, and event count header remain identical.

#### render_detail_view(width)

Builds the detail content lines (metadata + reason + input), applies scroll windowing, and renders within the same border frame.

### 5.7 State Reset on Refresh

When `r` is pressed to refresh:
- Event rows are reloaded.
- `selected_index` is clamped to the new row count (in case events were added/removed).
- If in detail view, switch back to list view (the underlying data may have changed).
- `scroll_offset` and `detail_scroll_offset` reset to 0.

### 5.8 State Reset on Panel Open

Each time the panel opens (via `show_damage_control_panel`), it creates a fresh `DamageControlPanel` instance. All state (`view`, `selected_index`, scroll offsets) starts at defaults. This is already the case with the current constructor pattern.

## 6. Error Handling and Failure Modes

### `selected_index_out_of_bounds`
- Trigger: Events list shrinks after refresh while `selected_index` was at a high value.
- Handling: Clamp `selected_index` to `Math.min(selected_index, rows.length - 1)`. If no rows, set to 0 and stay in list view.

### `empty_event_list_enter`
- Trigger: User presses Enter when there are no events.
- Handling: No-op. Don't switch to detail view.

### `detail_view_empty_input_preview`
- Trigger: `input_preview` is an empty string.
- Handling: Show `(no input captured)` in dim text.

### `detail_view_wrapping_overflow`
- Trigger: Extremely long single-word strings (URLs, base64, etc.) can't word-break within width.
- Handling: Hard-truncate at character boundary using `truncateToWidth()` as fallback after wrap attempt.

## 7. Security and Safety Considerations

- Same as existing panel: truncated/sanitized previews only. No raw full command strings exposed.
- `input_preview` is truncated to 500 chars at log write time (`index.ts:describe_tool_input`). The detail view shows this pre-truncated value, not the original unbounded input. The increase from 240 → 500 chars is modest and still well within safe bounds for session storage.
- No sensitive data exposure changes vs. current behavior.

## 8. Testing Strategy

The panel is a stateful component that manages view transitions, selection, scrolling, and keyboard input. Since it renders raw `string[]` lines (not a Container tree), the most effective testing approach is to extract pure logic into testable functions and test the panel class directly by calling `handleInput()` and inspecting rendered output.

### 8.1 New Test File: `__tests__/panel.test.ts`

Tests cover three areas: selection/navigation logic, view transitions & escape layering, and detail view rendering.

#### Test Helpers

```ts
// Reusable row factory matching DamageControlPanelRow shape
function make_row(overrides?: Partial<DamageControlPanelRow>): DamageControlPanelRow {
    return {
        timestamp: "2026-03-07T14:33:15.123Z",
        action: "blocked",
        tool_name: "bash",
        reason: "git reset --hard discards uncommitted changes",
        rule_type: "bash_pattern",
        rule_source: "bundled",
        input_preview: "git reset --hard HEAD~3",
        ...overrides,
    };
}

// Minimal TUI mock for panel construction
function make_tui_mock() {
    return {
        requestRender: vi.fn(),
        terminal: { rows: 40, columns: 80 },
    };
}

// Minimal theme mock that passes strings through
function make_theme_mock() {
    return {
        fg: (_color: string, text: string) => text,
        bold: (text: string) => text,
        bg: (_color: string, text: string) => text,
    };
}
```

#### Selection & Navigation

```
describe("DamageControlPanel — selection navigation", () => {

    it("initializes with selected_index 0")

    it("j moves selection down by 1")

    it("k moves selection up by 1")

    it("down arrow moves selection down by 1")

    it("up arrow moves selection up by 1")

    it("selection does not go below 0 when pressing k at first item")

    it("selection does not exceed rows.length - 1 when pressing j at last item")

    it("g jumps to first event (index 0)")

    it("G jumps to last event (index rows.length - 1)")

    it("Home jumps to first event")

    it("End jumps to last event")

    it("Page Down moves selection down by viewport height")

    it("Page Up moves selection up by viewport height")

    it("Page Down clamps to last row when near end")

    it("Page Up clamps to first row when near start")
})
```

#### Auto-Scroll (selection follows viewport)

```
describe("DamageControlPanel — auto-scroll", () => {

    it("scroll_offset adjusts down when selection moves below visible range")

    it("scroll_offset adjusts up when selection moves above visible range")

    it("scroll_offset stays put when selection is within visible range")

    it("selected row is always visible after any navigation key")
})
```

#### View Transitions & Escape Layering

```
describe("DamageControlPanel — view transitions", () => {

    it("starts in list view")

    it("Enter on selected event switches to detail view")

    it("Enter with no events is a no-op (stays in list view)")

    it("esc in detail view returns to list view")

    it("esc in list view calls done() to close modal")

    it("q in detail view returns to list view (same as esc)")

    it("q in list view calls done() to close modal")

    it("ctrl+c in detail view calls done() immediately")

    it("ctrl+c in list view calls done() immediately")

    it("esc in detail view preserves selected_index")

    it("esc in detail view resets detail_scroll_offset to 0")

    it("shortcut key in list view calls done()")

    it("shortcut key in detail view returns to list view")
})
```

#### Refresh Behavior

```
describe("DamageControlPanel — refresh", () => {

    it("r reloads rows from get_rows callback")

    it("r clamps selected_index when new row count is smaller")

    it("r switches from detail view back to list view")

    it("r resets scroll_offset to 0")

    it("r resets detail_scroll_offset to 0")
})
```

#### Detail View Rendering

```
describe("DamageControlPanel — detail view rendering", () => {

    it("detail view shows action badge and label")

    it("detail view shows tool name")

    it("detail view shows full ISO timestamp")

    it("detail view shows rule type")

    it("detail view shows rule source")

    it("detail view shows full reason text (not truncated to list width)")

    it("detail view shows full input preview")

    it("detail view shows '(no input captured)' for empty input_preview")

    it("detail view wraps long reason text to fit inner width")

    it("detail view wraps long input preview to fit inner width")

    it("detail view footer shows 'esc back' hint (not 'esc close')")
})
```

#### Detail View Scrolling

```
describe("DamageControlPanel — detail view scrolling", () => {

    it("j scrolls detail content down by 1 line")

    it("k scrolls detail content up by 1 line")

    it("detail scroll does not go below 0")

    it("detail scroll does not exceed max_scroll")

    it("Page Down scrolls by viewport height")

    it("Page Up scrolls by viewport height")

    it("g scrolls to top of detail content")

    it("G scrolls to bottom of detail content")

    it("scroll position indicator shows in footer when content is scrollable")

    it("scroll position indicator absent when content fits in viewport")
})
```

#### List View Rendering

```
describe("DamageControlPanel — list view rendering", () => {

    it("selected row has ▸ prefix marker")

    it("non-selected rows have space prefix for alignment")

    it("all rows have consistent indentation regardless of selection")

    it("footer shows 'j/k navigate' hint when events exist")

    it("footer shows 'enter detail' hint when events exist")

    it("footer omits navigation hints when no events exist")

    it("scroll position indicator appears when rows exceed viewport")
})
```

### 8.2 Updated Test File: `__tests__/logs.test.ts`

Add tests for the increased truncation limits:

```
describe("get_recent_damage_control_rows — truncation limits", () => {

    it("preserves reason up to 500 chars without truncation")

    it("truncates reason beyond 500 chars with ellipsis")

    it("preserves input_preview up to 500 chars without truncation")

    it("truncates input_preview beyond 500 chars with ellipsis")
})
```

### 8.3 Manual Validation

1. Open panel with multiple events. Verify `j`/`k` and `↑`/`↓` move the visual highlight with `▸` marker.
2. Verify non-selected rows have consistent indentation (no jumpiness).
3. Press Enter on a selected event. Verify detail view shows complete metadata, reason, and input preview.
4. In detail view with long content, verify `j`/`k` scroll the content.
5. Press `esc` in detail view — verify it returns to list (not closes modal).
6. Press `esc` again in list view — verify modal closes.
7. Press `q` in detail view — verify it goes back to list (not closes modal).
8. Press `q` again in list view — verify modal closes.
9. Press `ctrl+c` in detail view — verify modal closes immediately.
10. Press `r` while in detail view — verify it refreshes and returns to list.
11. Open panel with zero events. Press Enter — verify nothing happens.
12. Trigger a block with a long bash command (>240 chars). Open detail view — verify more of the command is visible than in the list row.
13. Resize terminal while panel is open — verify layout adapts.

## 9. Implementation Checklist

### Data layer changes
- [ ] Increase `describe_tool_input` truncation in `index.ts` from 240 → 500 chars.
- [ ] Increase `to_panel_row` truncation in `logs.ts`: `reason` 140 → 500, `input_preview` 180 → 500.

### Panel state & input handling
- [ ] Add `view`, `selected_index`, `detail_scroll_offset`, `detail_lines`, `detail_view_height` state to `DamageControlPanel`.
- [ ] Refactor `handleInput()` to dispatch based on `this.view`.
- [ ] Implement list-view key handling: `j`/`k`/arrows for selection, Enter for detail, `g`/`G`/Home/End for jump, PgUp/PgDn.
- [ ] Implement detail-view key handling: `j`/`k`/arrows for scroll, `esc`/`q` for back, `ctrl+c` for close, `g`/`G`/Home/End/PgUp/PgDn.

### Rendering
- [ ] Add `render_list_view()` with `▸` prefix on selected row, space prefix on others for alignment.
- [ ] Add `render_detail_view()` with metadata fields, wrapped reason/input, and scroll windowing.
- [ ] Update footer key hints to reflect active view (list vs detail).
- [ ] Add word-wrapping logic for detail text fields.

### Edge cases
- [ ] Handle empty event list (Enter is no-op, no navigation hints).
- [ ] Handle refresh clamp (`selected_index` clamped when rows shrink, detail view exits to list).
- [ ] Handle empty `input_preview` (show `(no input captured)` placeholder).

### Tests
- [ ] Create `__tests__/panel.test.ts` with selection navigation tests.
- [ ] Add auto-scroll tests (selection follows viewport).
- [ ] Add view transition tests (Enter → detail, esc → back, esc → close, q layering, ctrl+c immediate).
- [ ] Add refresh behavior tests (clamp, view reset, scroll reset).
- [ ] Add detail view rendering tests (all fields shown, wrapping, empty input placeholder).
- [ ] Add detail view scrolling tests (j/k/PgUp/PgDn/g/G bounds, indicator presence).
- [ ] Add list view rendering tests (▸ marker, space prefix alignment, footer hints).
- [ ] Update `__tests__/logs.test.ts` with tests for increased truncation limits (500 chars reason/input_preview).

### Validation
- [ ] Manual QA: all navigation paths, escape layering, scroll behavior, resize, long-content detail view.
- [ ] Run `bun run check`.

## 10. Resolved Design Decisions

1. **Selection marker style**: Use `▸` prefix in accent color for the selected row. Non-selected rows use a single-space prefix (` `) to maintain alignment and prevent layout jumpiness when moving selection. Background highlighting on raw string lines is unreliable across themes.

2. **`q` behavior in detail view**: `q` goes back to list first (same as `esc`). Both `q` and `esc` behave identically — layered dismissal in both cases. Only `ctrl+c` closes immediately from any view. This keeps the mental model simple: there's always one step back.

3. **Truncation limits for detail view**: The detail view exists to show more context than the list. The current truncation chain is too aggressive for this purpose:
   - **Log write time** (`index.ts:describe_tool_input`): increase from 240 → 500 chars. This is the hard ceiling on stored data.
   - **Panel row read time** (`logs.ts:to_panel_row`): increase `input_preview` from 180 → 500, `reason` from 140 → 500. Pass through the full stored data so the detail view can display it.
   - **List view render** (`panel.ts:format_event_row`): No change needed — already truncates to fit available line width.
   - The net effect: list view looks identical; detail view shows meaningfully more context for bash commands and long rule reasons.
