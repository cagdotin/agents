# Tracks Extension — Rebuild Spec

Retired: 2026-05-18

## Purpose

Repo-agnostic workstream tracking for Pi. The extension created and managed durable workspaces under `.pi/tracks/<slug>/` so an initiative could stay open across multiple sessions and milestones. It was meant to give agents a local `AGENTS.md`, structured working files, deterministic summary regeneration, and explicit closeout semantics without depending on repo-specific backlog systems.

---

## User-facing surface

### Tool: `track`

Registered as a Pi tool for agent automation.

Actions:
- `list`
- `get`
- `create`
- `set-active`
- `status`
- `sync`
- `end`

Tool intent:
- create/select/inspect/sync/close tracks under `.pi/tracks/`
- treat tracks as long-running workstreams, not one-shot tasks
- avoid assuming a track should close after a single implementation pass

The tool returned plain-text content for the model plus structured `details` for renderers/state.

### Command: `/track`

Subcommands:
- `/track list`
- `/track new <name> --purpose "..." [--activate]`
- `/track use <name>`
- `/track status [name]`
- `/track sync [name]`
- `/track end [name]`

Behavior notes:
- `new --activate` both created the workspace and attached the current session.
- `use` persisted the latest project-level selection and attached the session.
- `status`, `sync`, and `end` defaulted to the current session track when possible.
- command completions were based on existing track slugs.

### Prompt / UI surface

When a session had an attached track:
- before agent start, Pi injected only that track's local `AGENTS.md` and generated `summary.md`
- a custom message renderer displayed the active track name/purpose in the conversation UI
- session shutdown performed a best-effort sync of the attached track

There was no standalone TUI panel; the UX was command + tool + injected context.

---

## Data model

### Storage location

Project-local runtime state under:
- `.pi/tracks/settings.json`
- `.pi/tracks/<slug>/...`

### Workspace layout

Canonical layout:

```text
.pi/tracks/
  settings.json
  <track-slug>/
    AGENTS.md
    track.yaml
    summary.md
    tasks.md
    references.md
    findings.md
    decisions.md
    report.md
    notes/
    artifacts/
```

### `track.yaml`

Machine-readable metadata file containing at least:
- slug/name
- purpose
- status (open/closed)
- created/updated timestamps
- session count
- related paths

The extension treated this file as the authoritative record for track metadata and status.

### `settings.json`

Project-level latest selection:

```json
{
  "active_track": "example-slug"
}
```

Important design detail: this was not the authority for the current running session. It only remembered the latest project-level selection.

### Session trace entries

The current session attachment was mirrored in Pi session entries. Runtime behavior followed the session trace, not `settings.json`, so parallel sessions would not steal each other's active track or shutdown sync target.

### Templates

Canonical markdown templates lived under `extensions/tracks/templates/` and were copied into new workspaces. Policy lived in those files rather than being hard-coded as string blobs.

---

## Lifecycle

### `session_start`
- ensure `.pi/tracks/` exists
- ensure `settings.json` exists
- restore footer/status from session trace + track files

### `session_tree` / `session_compact`
- restore track status after session traversal / compaction events

### `before_agent_start`
- resolve current session track from session branch/trace
- load `AGENTS.md` and `summary.md`
- if files were missing, attempt `sync`
- inject track context into the system prompt

### `session_shutdown`
- best-effort `sync` of attached track

### Registration
- registered a `track` tool
- registered `/track` command
- registered a custom message renderer for track context messages

---

## Key behaviors

### Creation
- slugified the requested name
- created the canonical directory/file set atomically
- rejected duplicates with actionable errors
- required a non-empty purpose

### Active-track semantics
- project-level latest selection persisted in `settings.json`
- current-session attachment came from session trace state
- allowed multiple sessions in one repo without clobbering the wrong track

### Sync
- regenerated `summary.md` deterministically from source files in the workspace
- repaired missing template-backed files when possible
- kept `report.md` as a live, manually updated artifact rather than overwriting it wholesale

### End / closeout
- ran sync first
- marked the track closed in metadata
- finalized closeout state while keeping the workspace on disk
- cleared `settings.json` only if the closed track matched the persisted active track
- did not automate promotion into issues, repo docs, or any external system

### Error handling
- missing/malformed tracks produced agent-legible repair messages
- command usage errors printed concrete usage strings
- if context injection failed, the extension warned instead of crashing the session

### Sorting / listing
- list output was slug-sorted
- list/status views marked both persisted-active and session-active state
- malformed directories were skipped from sync listings rather than crashing completions

---

## Dependencies

### Pi APIs used
- extension lifecycle hooks (`session_start`, `session_tree`, `session_compact`, `before_agent_start`, `session_shutdown`)
- `registerTool()`
- `registerCommand()`
- `registerMessageRenderer()`
- session-manager branch/session access for session-local binding
- UI notifications/status rendering

### Libraries / repo helpers
- TypeScript source loaded directly by Pi
- TypeBox + `StringEnum` for tool params
- Zod/YAML parsing for runtime file validation/serialization
- `@earendil-works/pi-tui` primitives for the custom message renderer

### Peer patterns
- session-state restoration pattern similar to other stateful extensions
- template-backed generation instead of embedded markdown strings

---

## Design decisions

- **File-based workspaces over a database** — tracks were human-readable, inspectable, and easy to sync.
- **Repo-agnostic scope** — the extension managed only `.pi/tracks/` plus mirrored session state, not GitHub issues or repo-specific project management.
- **Session trace as runtime authority** — fixed cross-session clobbering that happened when `settings.json` alone drove behavior.
- **Template files as policy surface** — made generated track content transparent and editable.
- **Deterministic `summary.md`** — a compressed generated snapshot for prompt injection and restartability.
- **Manual `report.md`** — kept an editable, narrative live artifact distinct from the deterministic summary.
- **Closeout without auto-promotion** — ending a track documented closure but intentionally did not mutate systems outside `.pi/tracks/`.

---

## Tests at time of removal

Test coverage existed in:
- `extensions/tracks/__tests__/storage.test.ts`
- `extensions/tracks/__tests__/helpers.test.ts`
- `extensions/tracks/__tests__/actions.test.ts`

Coverage focused on workspace creation, settings persistence, listing, sync/end behavior, session-active semantics, formatting/serialization helpers, and actionable error paths.
