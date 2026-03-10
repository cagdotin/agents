# Session Stats — File Operation Timeline Mode

Status: Implemented
Todo: (none)
Date: 2026-03-10
Execution plan: [[docs/exec-plans/active/2026-03-10-session-stats-read-timeline-mode.md]]

## 1. Problem statement

The current `Session Stats` detail views for file-operation tools (Read, Edit, Write) show unique files only — either grouped by category (Read) or as flat sorted lists (Edit, Write). This helps with coverage, but it hides sequence:

- when each file operation occurred,
- the exact order of operations,
- and where user prompts occurred relative to file operations.

Users cannot answer timeline questions like: "After the user's second message, which files did we read first?" or "In what order were edits made?"

## 2. Goals and non-goals

### 2.1 Goals

- Add a **Timeline** mode to Read, Edit, and Write detail views.
- Keep existing grouped categories mode as default for all three.
- Show each file operation event with:
  - timestamp,
  - global per-tool order index,
  - file path,
  - category marker.
- Show neutral **user message markers** in the timeline (no message text/details).
- Preserve chronological order across the full session branch.
- Use a shared event model (`FileTimelineEvent`) and rendering infrastructure across all three tools.
- Keep interaction minimalistic and keyboard-first.

### 2.2 Non-goals

- Message content preview in timeline.
- Cross-tool unified timeline (each tool has its own independent timeline with independent ordering).
- Nanosecond-accurate execution timing or duration bars.
- Persisting timeline data outside current stats reconstruction.

## 3. System context

Affected area: `extensions/session-stats/`

- `types.ts`: add `FileTimelineEvent` discriminated union type and per-tool timeline arrays to `ToolDetails`.
- `tracker.ts`: capture file operation events + user markers for each tool while reconstructing stats.
- `panel.ts`: add file detail mode toggle + timeline renderer shared across Read/Edit/Write.
- `__tests__/tracker.test.ts`: add timeline extraction and ordering tests for all three tools.
- `README.md`: document mode toggle and timeline semantics.

## 4. Domain model

Additions:

```ts
type FileTimelineEvent =
  | {
      kind: "user-marker";
      timestamp: string;
      user_message_index: number;
    }
  | {
      kind: "file-op";
      timestamp: string;
      op_order: number;
      path: string;
      category: FileCategory;
      user_message_index: number;
      is_repeat: boolean;
    };

interface ToolDetails {
  // existing fields...
  read_timeline_events: FileTimelineEvent[];
  edit_timeline_events: FileTimelineEvent[];
  write_timeline_events: FileTimelineEvent[];
}
```

Notes:
- `op_order` is a 1-based per-tool sequence index (Read, Edit, and Write each have independent counters).
- `user_message_index` links each event to the nearest prior user marker (0 = before first user message).
- `is_repeat` is computed from prior events of the same path within that tool's timeline.
- User markers are pushed to all three timelines on every user message, even if that tool has not been used yet. This keeps timelines consistent when switching between tools.

## 5. Detailed design

### 5.1 Reconstruction strategy

During `reconstruct_stats()` walk, three `TimelineTracker` instances (one per tool) track independent state:

```ts
interface TimelineTracker {
  events: FileTimelineEvent[];
  order_counter: number;
  seen_paths: Set<string>;
}
```

1. On `message.role === "user"`:
   - increment user prompt count (existing behavior),
   - push `user-marker` to all three timelines with entry timestamp and index.
2. On assistant `toolCall` blocks with `name` matching Read/Edit/Write:
   - keep existing unique file list update,
   - append a `file-op` event to the corresponding timeline,
   - increment that tracker's `order_counter`,
   - compute category via `categorize_file(path)`,
   - set `is_repeat` if path was previously seen by that tracker.

Ordering guarantee: events are appended in branch traversal order + in-content block order.

### 5.2 File detail mode toggle UX

In Read, Edit, or Write detail view, show a minimal mode switch:

`Mode: [Categories]  Timeline  (t toggle · 1/2)` or `Mode: Categories  [Timeline]  (t toggle · 1/2)`

Keybindings:
- `t`: toggle mode
- `1`: categories
- `2`: timeline

Mode resets to "categories" when entering any detail view. The `has_timeline_mode()` guard ensures these keys are only active for Read/Edit/Write.

### 5.3 Rendering

**Categories mode** (shared `render_file_categories`): files grouped by category with `◇◆△○` icons — formerly separate implementations for Read vs Edit/Write, now unified.

**Timeline mode** (shared `render_file_timeline`): compact rail style:

```text
Files Read (12)

16:09:01  ● user message

16:09:03  01 ◇ docs/ARCHITECTURE.md
16:09:05  02 ◆ skills/plan/SKILL.md
16:09:07  03 ○ extensions/session-stats/tracker.ts

16:10:10  ● user message

16:10:11  04 ◇ docs/QUALITY.md
16:10:12  05 ◇ docs/QUALITY.md  ↺

◇ docs  ◆ skills  △ tests  ○ code  ↺ repeat
```

Legend:
- `●` user marker
- `◇ docs`, `◆ skills`, `△ tests`, `○ code`
- `↺` repeat operation

Formatting:
- timestamp display: local `HH:mm:ss`
- fallback: `--:--:--` if parse fails
- order index zero-padded to consistent width
- path truncation uses `truncateToWidth`

### 5.4 Navigation and scrolling

Reuses current detail scrolling behavior (`j/k`, `g/G`, `page up/down`).
No new scroll model needed.

### 5.5 Plain-text fallback

For non-UI mode (`/ss` in print mode), a shared `append_plain_text_timeline` helper renders each tool's timeline:
- first 20 events
- then `... (+X more)`

Keeps logs useful without flooding stdout.

## 6. Error handling and failure modes

- Missing/invalid entry timestamp: show `--:--:--` placeholder.
- Tool call without valid `path`: skip timeline event (defensive guard on `typeof path === "string"`).
- Tools with zero file ops: timeline mode shows "No events yet." User markers still present.
- Very large sessions: rendering remains scrollable; event storage is linear and bounded by session history size.

## 7. Testing strategy

### 7.1 Unit tests (`tracker.test.ts`)

Tests for each tool's timeline:
- Timeline includes user markers and file-op events in strict branch order.
- `op_order` is sequential within each tool and independent across tools.
- Duplicate file operations set `is_repeat: true` on subsequent events.
- Operations before any user message get `user_message_index = 0`.
- Existing unique file list behavior remains unchanged alongside timeline events.
- User markers propagate to all three timelines even when only one tool is used.
- Sessions with no file ops produce timelines with user markers only.

### 7.2 Plain-text summary tests (`tracker.test.ts`)

Tests for `build_plain_text_summary` timeline output:
- User markers and file ops appear in output.
- Repeat marker (`↺`) renders correctly.
- Truncation at 20 events with overflow indicator.
- Timeline section omitted when no file ops exist.

### 7.3 Manual UI validation

- Open `/ss`, enter Read/Edit/Write detail.
- Toggle categories/timeline with `t` (and `1/2`).
- Verify markers appear between file operation sequences.
- Verify order and time labels are intuitive in a multi-prompt session.
- Verify mode resets to categories when switching between tools.

## 8. Implementation checklist

- [x] Add `FileTimelineEvent` type and per-tool timeline arrays to `ToolDetails`
- [x] Extend tracker reconstruction to emit user markers + file-op events for Read/Edit/Write
- [x] Track per-tool `op_order`, `user_message_index`, `is_repeat` via `TimelineTracker`
- [x] Unify Read/Edit/Write detail rendering via `detail_file_tool` with shared mode switch
- [x] Add timeline mode renderer with legend and minimal rail layout
- [x] Add keybindings (`t`, `1`, `2`) in detail view, guarded by `has_timeline_mode()`
- [x] Add tracker unit tests for timeline extraction and ordering (all three tools)
- [x] Add plain-text summary tests for timeline output
- [x] Extract `append_plain_text_timeline` helper to eliminate duplication
- [x] Update README docs
- [x] Run `bun test extensions/session-stats`
- [x] Run `bun run check`

## 9. Open questions

1. ~~Should timeline default to oldest-first or newest-first?~~
   - Resolved: oldest-first (narrative order).
2. ~~Should repeat operations be fully repeated rows or collapsed as `xN` summaries?~~
   - Resolved: repeated rows with `↺`, no collapsing.
3. ~~Should we expose timeline for Edit/Write with the same event model?~~
   - Resolved: yes, implemented in this change using a shared `FileTimelineEvent` model.
