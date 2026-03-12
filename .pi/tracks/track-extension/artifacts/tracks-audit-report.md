# Tracks Extension Audit Report

**Date:** 2026-03-11
**Scope:** `extensions/tracks/` — all source files, tests, templates, README
**Baseline:** 11 tests passing, 1 biome format issue (`.pi/tracks/settings.json` — not extension code)

---

## Issues to fix

### 1. Duplicated `mark_session_active` function

**Severity:** Warning
**Files:** `extensions/tracks/index.ts` (line 64), `extensions/tracks/tool.ts` (line 18)

The same function is defined identically in both files:

```ts
function mark_session_active(track_record: TrackRecord, session_track: string | undefined): TrackRecord {
	return {
		...track_record,
		is_active: track_record.slug === session_track,
	};
}
```

**Fix:** Move it to `extensions/tracks/helpers.ts` as a single named export. Update both `index.ts` and `tool.ts` to import it from there.

---

### 2. Duplicated command/tool action logic (~450 lines of parallel code)

**Severity:** Warning (highest-value refactor)
**Files:** `extensions/tracks/index.ts` (lines 156–310, the `/track` command handler), `extensions/tracks/tool.ts` (lines 50–190, the tool `execute` method)

Both implement the same actions (list, create, use/set-active, status, sync, end) with nearly identical control flow. Any behavior change must be made in two places. The reference extension (`extensions/todos/`) avoids this by having command and tool share a common action layer.

**Fix:** Extract shared action functions into `extensions/tracks/helpers.ts` (or a new `extensions/tracks/actions.ts`). Each action function should:
- Accept `tracks_dir`, `session_track`, params, and a `trace` callback
- Return a structured result (the track record or list, plus any error)
- Let the command handler and tool each call the shared action and format the output for their own context (UI notify vs tool content array)

Suggested action functions:
- `action_list(tracks_dir, session_track)`
- `action_get(tracks_dir, session_track, name?)`
- `action_create(tracks_dir, session_track, name, purpose, related_paths?, activate?, trace_fn)`
- `action_set_active(tracks_dir, name, trace_fn)`
- `action_sync(tracks_dir, session_track, name?)`
- `action_end(tracks_dir, session_track, name?, trace_fn)`

The command handler's `tokenize_command_args` and `output_message` stay in `index.ts` since they're command-specific. The tool's `renderCall`/`renderResult` stay in `tool.ts`.

---

### 3. Unhandled re-read after sync in `before_agent_start`

**Severity:** Warning
**File:** `extensions/tracks/index.ts`, lines 100–115

```ts
} catch {
    const synced = await sync_track_record(tracks_dir, track_record.slug);
    track_record = synced;
    // These reads have NO error handling — will throw into Pi runtime
    [agents_md, summary_md] = await Promise.all([
        read_track_file(track_record.dir, "AGENTS.md"),
        read_track_file(track_record.dir, "summary.md"),
    ]);
}
```

**Fix:** Wrap the fallback reads in their own try/catch. If they still fail, log a warning via `ctx.ui.notify` and `return` without injecting context (same pattern as the metadata read error above it).

---

### 4. `list_tracks` silently swallows metadata parse errors

**Severity:** Warning
**File:** `extensions/tracks/storage.ts`, line 427

```ts
try {
    const metadata = await read_track_metadata(track_dir);
    tracks.push({ ... });
} catch {}  // ← track silently vanishes from listings
```

**Fix:** Don't change the control flow (skip the track is correct), but log the error so users know a track directory exists but is unreadable:

```ts
} catch (error) {
    console.warn(`Skipping track '${entry}': ${error instanceof Error ? error.message : String(error)}`);
}
```

---

### 5. Dead exports to remove

**Severity:** Note
**Files:**

1. **`load_active_track_record`** in `extensions/tracks/helpers.ts` (bottom of file) — defined, exported, never imported or called anywhere. Delete it entirely.

2. **`get_tracks_dir_label`** in `extensions/tracks/storage.ts` — takes a `_cwd` parameter it ignores and just returns the constant `TRACKS_DIR_NAME`. Either remove the unused parameter or inline the constant at the single call site in `index.ts`.

3. **`read_track_record_sync`** in `extensions/tracks/storage.ts` — exported but only used internally by `list_tracks_sync` (via iteration). Remove the `export` keyword to make it module-private.

---

### 6. Bare `catch {}` blocks (9 total)

**Severity:** Warning
**Files:** `extensions/tracks/storage.ts` (7), `extensions/tracks/index.ts` (1), `extensions/tracks/helpers.ts` (1)

Most are intentional fallbacks (settings file missing, directory doesn't exist), but none log anything. At minimum:

- `storage.ts` line 427 (`list_tracks` metadata parse) — add `console.warn` (see issue #4)
- `storage.ts` line 89 (`read_track_settings`) — fine as-is (returns default `{}`)
- `helpers.ts` line 439 (`read_track_record_sync_safe`) — fine as-is (returns `null`)
- The rest in `list_tracks_sync` and `list_tracks` — evaluate whether a `console.warn` would help debugging

**Fix:** Add comments to intentional swallows (e.g., `// settings file missing or malformed — use defaults`) so the intent is clear. Add `console.warn` to the ones where data loss is non-obvious (metadata parse failures).

---

### 7. Tool `execute` params typed as `any`

**Severity:** Note
**File:** `extensions/tracks/tool.ts`, line 56

```ts
async execute(
    _tool_call_id: string,
    params: any,  // ← should be typed
    ...
```

**Fix:** Import `Static` from `@sinclair/typebox` and type as `params: Static<typeof TrackParams>`. This gives internal type safety on `params.action`, `params.name`, etc.

---

### 8. Missing test coverage

**Severity:** Warning
**Current state:** 11 tests in 2 files (293 lines). Covers helpers and storage. For comparison, `extensions/todos` has 975 lines of tests across 3 files for similar code size.

**Missing coverage:**

| Area | Priority | Notes |
|---|---|---|
| Command handler (`index.ts` handler) | High | The primary user-facing entry point is untested. If action logic is extracted (issue #2), this becomes much easier to test. |
| Tool execute (`tool.ts`) | High | Same — extract actions first, then test the shared actions. |
| YAML parser edge cases | Medium | `parse_track_metadata_yaml` is hand-rolled and handles quoting, arrays, type coercion. No dedicated tests exist. Only exercised indirectly via round-trip happy path. Test cases needed: special characters in purpose, empty arrays, missing optional fields, extra unrecognized keys. |
| `restore_track_status` | Medium | Runs on every session lifecycle event. A bug here silently breaks the status bar. Needs a mock `ctx` with `ui.setStatus` and `sessionManager.getBranch`. |
| `finalize_report_markdown` | Low | Closeout block insertion and idempotent replacement logic. |
| `collect_markdown_list_items` with checkbox filtering | Low | The `checkboxes_only` path has tricky logic around checked vs unchecked state. |

**Recommended approach:** After extracting the shared action layer (issue #2), add an `actions.test.ts` that tests the unified action functions against a temp directory. This gives command + tool coverage in one shot.

---

### 9. Custom YAML parser limitations (informational)

**Severity:** Note (no action needed now, document for future)
**File:** `extensions/tracks/storage.ts`, `parse_track_metadata_yaml`

The parser handles flat key-value pairs and simple string arrays. It does NOT handle:
- Nested objects
- Multi-line strings (`|` or `>` block scalars)
- Inline arrays (`[a, b, c]`)
- Comments after values

This is fine for the current `TrackMetadata` schema. If metadata ever needs nested structures, switch to a real YAML parser or move to JSON.

---

## Suggested execution order

1. **Extract shared action functions** (issue #2) — this is the foundation for everything else
2. **Move `mark_session_active` to helpers** (issue #1) — trivial, do it during #1
3. **Remove dead exports** (issue #5) — trivial cleanup
4. **Guard the `before_agent_start` fallback** (issue #3) — small, isolated fix
5. **Add `console.warn` to swallowed errors** (issues #4, #6) — small, isolated
6. **Type tool params** (issue #7) — trivial
7. **Add tests for shared actions, YAML parser, restore_track_status** (issue #8) — biggest effort, but now much easier because actions are extracted
8. **Document YAML parser limitations** (issue #9) — comment in code

Items 1–6 can likely be done in one pass. Item 7 is a separate pass.
