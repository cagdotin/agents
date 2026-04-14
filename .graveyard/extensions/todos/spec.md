# Todos Extension — Rebuild Spec

Retired: 2026-04-14

## Purpose

File-based todo management for Pi sessions. Provided a `todo` tool for agent automation and a `/todos` command with a full interactive TUI for browsing, filtering, and acting on todos. Designed for multi-session use with assignment/claiming to avoid collisions.

---

## User-facing surface

### Tool: `todo`

Registered as a Pi tool. Actions:

| Action     | Required params       | Description |
|------------|-----------------------|-------------|
| `list`     | —                     | List open + assigned todos (excludes closed) |
| `list-all` | —                     | List all todos including closed |
| `get`      | `id`                  | Get full todo record by id |
| `create`   | `title`               | Create a new todo. Optional: `tags`, `status`, `body` |
| `update`   | `id`                  | Update fields. Optional: `title`, `status`, `tags`, `body` (replaces) |
| `append`   | `id`, `body`          | Append text to body (does not replace) |
| `delete`   | `id`                  | Delete todo (requires lock) |
| `claim`    | `id`                  | Assign todo to current session. Optional: `force` to override |
| `release`  | `id`                  | Release assignment. Optional: `force` to release another session's claim |

Parameters defined with TypeBox `Type.Object` + `StringEnum` for the action field.

**ID format:**
- Display format: `TODO-<hex>` (8-char hex, e.g., `TODO-a1b2c3d4`)
- Input: accepts `TODO-<hex>`, `#TODO-<hex>`, or raw hex
- Internal storage: raw lowercase hex string
- Generated via `crypto.randomBytes(4).toString("hex")` with collision check

**Tool rendering:**
- `renderCall`: shows action, id (if present), title (if present)
- `renderResult`: themed list/detail views with expand support, action labels (Created, Updated, etc.), expand hint for collapsed views

### Command: `/todos [search]`

Interactive TUI workflow with four component layers:

1. **TodoSelectorComponent** — filterable list of all todos, grouped by assignment status. Supports fuzzy search (multi-token AND matching). Quick-action shortcuts for "work" and "refine" directly from the selector.

2. **TodoActionMenuComponent** — context menu for a selected todo with actions: work, refine, view, close/reopen, release, delete, copy path, copy text.

3. **TodoDetailOverlayComponent** — overlay panel showing full todo details (status, tags, created date, body). Has a "work" action to prefill the editor.

4. **TodoDeleteConfirmComponent** — confirmation dialog before deletion.

**Editor prefill actions:**
- "work" → prefills editor with `work on todo TODO-<hex> "<title>"`
- "refine" → prefills editor with a structured refinement prompt asking the agent to ask clarifying questions before rewriting

**Non-UI fallback:** When `ctx.hasUI` is false, prints plain-text todo list to console.

---

## Data model

### Storage location

`<cwd>/.pi/todos/` (overridable via `PI_TODO_PATH` env var).

### Todo file format

Markdown files with YAML frontmatter. Filename is title-slugified (e.g., `fix-login-bug.md`). Slug rules: lowercase, alphanumeric + hyphens, max 80 chars, dedup with `-2`, `-3` suffix.

```yaml
---
id: a1b2c3d4
title: "Fix login bug"
tags:
  - auth
  - urgent
status: open
created_at: "2026-04-10T14:30:00.000Z"
assigned_to_session: abc123
---

Detailed description and notes here.
```

**Frontmatter fields:**
- `id` — 8-char hex, unique identifier
- `title` — short summary
- `tags` — string array
- `status` — `open`, `closed`, `done`, or custom
- `created_at` — ISO 8601 timestamp
- `assigned_to_session` — session id string, cleared when status becomes closed/done

**Validation:** Zod schema (`todo_frontmatter_schema`) with normalization fallbacks. Invalid frontmatter falls back to defaults (empty title, open status, empty tags).

**Legacy support:** JSON frontmatter from older versions is detected and normalized to YAML on parse. A migration pass on startup renames hex-id filenames to title-slugified names.

### Lock files

`<id>.lock` JSON files in the todos directory. Used for write operations.

```json
{
  "id": "a1b2c3d4",
  "pid": 12345,
  "session": "abc123",
  "created_at": "2026-04-10T14:30:00.000Z"
}
```

- TTL: 30 minutes
- Stale locks can be stolen with user confirmation (interactive mode only)
- Exclusive file creation (`fs.open` with `wx` flag) for atomic locking

### Settings

`<todos_dir>/settings.json`:

```json
{
  "gc": true,
  "gc_days": 7
}
```

Defaults: gc enabled, 7-day retention for closed todos.

---

## Lifecycle

### `session_start`

1. Ensure `.pi/todos/` directory exists
2. Migrate legacy hex-id filenames to title-slugified names
3. Read settings
4. Run garbage collection (delete closed todos older than `gc_days`)

### Tool + command registration

Done synchronously in the extension entrypoint (not gated behind any condition — always registered).

---

## Key behaviors

### Sorting

Todos are sorted: open before closed, assigned before unassigned (within open), then chronological by `created_at`.

### Filtering

Multi-token fuzzy search using pi-tui's `fuzzyMatch`. All tokens must match (AND logic). Search text includes: formatted id, raw id, title, tags, status, assignment.

### Assignment bucketing

Todos split into three groups for display: assigned, open (unassigned), closed. Used by both plain-text formatting and themed TUI rendering.

### Claiming/releasing

- Claim assigns the current session id to the todo
- Release clears the assignment
- Both respect locks and support `force` override
- Closing a todo automatically clears its assignment

### Garbage collection

On startup, deletes `.md` files with closed status where `created_at` is older than the configured cutoff. Controlled by `settings.json`.

---

## Dependencies

### Pi APIs used

- `pi.registerTool()` — todo tool with TypeBox params
- `pi.registerCommand()` — `/todos` command
- `pi.on("session_start")` — bootstrap
- `ctx.sessionManager.getSessionId()` / `getSessionFile()` — for claiming
- `ctx.ui.custom()` — TUI panel and overlay
- `ctx.ui.confirm()` — lock steal confirmation
- `ctx.ui.notify()` — action feedback
- `ctx.ui.setEditorText()` — prefill editor on work/refine
- `ctx.hasUI` — non-UI fallback
- `copyToClipboard()` — copy path/text
- `keyHint()` — keyboard shortcut labels

### External libraries

- `@sinclair/typebox` — tool parameter schema (`Type.Object`, `StringEnum`)
- `zod` — runtime validation for frontmatter, settings, lock info
- `@mariozechner/pi-tui` — `fuzzyMatch`, `Text`, `TUI` type
- `@mariozechner/pi-ai` — `StringEnum`

### YAML handling

Custom minimal YAML serializer/parser (not a full YAML library). Handles quoting for special chars, multiline arrays, and inline empty arrays. This was intentional to avoid a YAML dependency for a simple frontmatter format.

---

## Design decisions

- **File-based storage** over database — todos are human-readable, git-friendly, and work without external services. Each todo is one `.md` file.
- **Title-slugified filenames** instead of hex-id filenames — more readable in file browsers and git diffs. Migration from old hex-id names happens on startup.
- **Lock files** for write safety — simple, no-dependency concurrency control for multi-session use. Stale lock TTL prevents permanent deadlocks.
- **Inline YAML parser** instead of a YAML library — the frontmatter subset is tiny (flat keys + one array), not worth a dependency.
- **Assignment model** over branch-based ownership — lightweight, session-scoped, automatically cleared on close.
- **Garbage collection** on startup — keeps the todo directory clean without manual intervention. Configurable retention window.
- **TUI with component layers** — selector → action menu → detail/confirm pattern gives keyboard-driven workflow without modal dialogs blocking the terminal.

---

## Test coverage at time of removal

- `helpers.test.ts` — 28 tests: id normalization, validation, status checks, sorting, filtering, bucketing, prompt building
- `storage.test.ts` — 47 tests: frontmatter parse/serialize, JSON→YAML migration, file read/write, listing, garbage collection, settings, title slugification
- `formatting.test.ts` — 11 tests: plain-text and themed rendering of headings, lists, assignment suffixes
