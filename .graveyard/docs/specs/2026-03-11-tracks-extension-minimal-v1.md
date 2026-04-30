# Tracks extension — minimal workstream track

Status: Draft
Date: 2026-03-11
Execution plan: [[docs/exec-plans/active/2026-03-11-tracks-extension-minimal-v1.md]]

## 1. Problem statement

Pi does not yet provide a first-class, workstream-scoped track where one or more agents
can keep a standardized snapshot of an initiative in progress using only a local runtime
folder. In practice, ongoing workstream context often ends up fragmented across session
history, temporary notes, and ad-hoc markdown files.

That makes it harder to:

- restart work in a fresh session without replaying old context,
- keep multiple agents aligned on the same task,
- preserve a consistent "read this first" path for track-local context,
- maintain workstream-specific findings in a predictable on-disk format,
- close a track cleanly when the broader initiative is actually done.

Desired end state:

- Pi provides a `tracks` extension under `extensions/`.
- The extension manages standardized workstream tracks in `.pi/tracks/<track-slug>/`.
- Each track has its own local `AGENTS.md` that acts as a track-scoped table of contents
  and progressive-disclosure map.
- Agents attached to a track can load the track context automatically and refresh the
  track snapshot at explicit checkpoints and on session shutdown.
- The extension is repo-agnostic: it assumes nothing about project docs, architecture,
  task systems, or file layout outside `.pi/tracks/`.
- The minimal version intentionally avoids coupling to any external task system,
  multi-handoff history, and sub-agent orchestration.

## 2. Goals and non-goals

### 2.1 Goals

- Provide a `tracks` extension under `extensions/`.
- Standardize a workstream track layout under `.pi/tracks/<track-slug>/`.
- Generate track files from templates so every track starts with the same structure and
  embedded instructions.
- Make the track-local `AGENTS.md` the entrypoint for track-local context, using generic
  progressive disclosure rather than project-specific assumptions.
- Provide lightweight commands and a tool for creating, selecting, inspecting,
  syncing, and closing tracks.
- Automatically load compact track context when a session is attached to a track.
- Automatically refresh a task snapshot on session shutdown so the next session can
  resume from compressed state.
- Keep the representation plain and inspectable: markdown for human/agent guidance,
  YAML/JSON for machine-readable metadata.
- Keep the extension repo-agnostic: runtime behavior and generated files manage only
  `.pi/tracks/` and do not assume any other repository structure.

### 2.2 Non-goals

- No dependency on any external task system or project-specific extension.
- No multi-handoff system or handoff history in v1.
- No sub-agent spawning, claim coordination, or role assignment in v1.
- No automatic mutation of files outside `.pi/tracks/` during `track end`, except for
  the session-trace entry used for track traceability.
- No assumptions about repository docs, architecture files, package manager, or source
  layout outside `.pi/tracks/`.
- No rich TUI browser or dashboard in v1; command-driven workflow is sufficient.
- No attempt to persist every intermediate thought or raw tool output. Tracks store
  compressed working state, not exhaustive logs.

## 3. System context

### 3.1 Extension shape

New module:

```text
extensions/tracks/
├── index.ts          # extension entry: command/tool registration + hooks
├── constants.ts      # filenames, statuses, command names, custom message types
├── storage.ts        # file I/O, slug handling, metadata parsing/writing
├── helpers.ts        # formatting, snapshot assembly, reference normalization
├── tool.ts           # `track` tool definition + renderers
├── README.md         # behavior and usage docs
├── types.ts          # TypeBox params + Zod runtime schemas/types
└── templates/
    ├── AGENTS.md
    ├── summary.md
    ├── tasks.md
    ├── references.md
    ├── findings.md
    ├── decisions.md
    └── report.md
```

### 3.2 Track workspace shape

Minimal canonical track layout:

```text
.pi/tracks/<track-slug>/
├── AGENTS.md
├── track.yaml
├── summary.md
├── tasks.md
├── references.md
├── findings.md
├── decisions.md
├── report.md
├── notes/
└── artifacts/
```

### 3.3 Extension stance for v1

This extension should not treat any existing local extension as the normative reference
implementation. It is establishing a new reusable pattern: a file-backed workstream track
manager that generates and maintains a canonical on-disk format.

The right mental model for v1 is:
- a small CLI/tooling layer for agents and users,
- operating on plain files in a specified format,
- with templates as the policy surface,
- and storage/helpers/hooks as the mechanism.

### 3.4 Design principles from Unix philosophy

This extension should explicitly follow these rules from
`docs/resources/unix-philosophy-raymond.md`:

- **Modularity**: keep templates, storage, hooks, and tool/command surfaces separate.
- **Clarity**: prefer obvious file meanings and explicit update rules over clever magic.
- **Composition**: tracks should compose with whatever repository content exists, but the extension itself should assume nothing beyond `.pi/tracks/`.
- **Separation**: keep track policy in templates/docs and mechanism in extension code.
- **Simplicity / Parsimony**: minimal command-driven workflow first; no orchestration layer yet.
- **Transparency / Robustness**: use plain files so agents and humans can inspect and repair state.
- **Representation**: encode read order, file purposes, and track metadata as data on disk.
- **Least Surprise**: every track should look the same and boot the same way.
- **Repair**: malformed tracks should fail noisily with concrete fix instructions.
- **Generation**: use templates to create tracks instead of hand-rolling each workspace.
- **Extensibility**: reserve room for future handoffs, promotion workflows, and sub-agent support.

## 4. Domain model

### 4.1 Track metadata (`track.yaml`)

`track.yaml` is the machine-readable source for current track state.

```yaml
name: tracks-extension-minimal-v1
purpose: add minimal task workspaces with local AGENTS.md and snapshots
status: active
created_at: 2026-03-11T17:30:00Z
updated_at: 2026-03-11T17:30:00Z
last_synced_at: 2026-03-11T17:30:00Z
session_count: 1
related_paths:
  - src/auth/
  - docs/design-notes.md
  - scripts/release.sh
```

Required fields for v1:

- `name`
- `purpose`
- `status` (`active` | `paused` | `closed`)
- `created_at`
- `updated_at`
- `last_synced_at`
- `related_paths` (may be empty)

Optional fields in v1:

- `session_count`
- `closed_at`
- `summary_version`

### 4.2 File roles

#### `AGENTS.md`
Track-local table of contents and operating rules. Must stay short and stable.

Required sections:
- Purpose
- Read this first
- File guide
- Update rules
- Closeout rules

#### `summary.md`
The compressed truth of the task. If a new agent reads only one content file after
`AGENTS.md`, this should be it.

#### `tasks.md`
Track-local checklist, milestones, and next-step list.

#### `references.md`
Curated progressive-disclosure reading list for this task: repo files, docs, and
resources worth reading, grouped by when they matter.

#### `findings.md`
Non-obvious discoveries that matter for the task.

#### `decisions.md`
Decision log with rationale and tradeoffs.

#### `report.md`
Rolling task report. It should be updated during work and finalized on `track end`, not
left empty until the task closes.

### 4.3 Active track binding and traceability

The extension needs:
1. a project-local settings file to remember the most recent project-level track selection, and
2. a mirrored session custom entry that acts as the source of truth for which track the current session is attached to.

Project-local storage:

```text
.pi/tracks/settings.json
```

Shape:

```json
{
  "active_track": "tracks-extension-minimal-v1"
}
```

Session traceability:
- when a track is activated or cleared, append a custom session entry recording the
  change,
- on session load, inspect the latest relevant custom entry so footer/widget state and
  runtime binding can be restored quickly,
- `.pi/tracks/settings.json` records the latest project-level selection, but runtime
  injection, command defaults, and shutdown sync for an already-running session follow the
  session trace entry instead.

This keeps v1 simple while still leaving an observable trace in session history without
letting parallel Pi sessions steal each other's attached track.

## 5. Detailed design

### 5.1 Template generation (Rule of Generation + Representation)

New tracks are generated by copying canonical files from `extensions/tracks/templates/`.
The extension must not create partially-specified ad-hoc folders or synthesize initial
file contents inline when a tracked template file already exists.

Track creation flow:
1. Normalize the requested name into a slug.
2. Create the track directory if it does not exist.
3. Copy all canonical markdown templates from `extensions/tracks/templates/` into the
   new track directory.
4. Create `notes/` and `artifacts/` directories.
5. Persist metadata in `track.yaml`.
6. Optionally mark the new track as active.

Each template should include concise embedded instructions describing:
- what belongs in the file,
- what does not belong,
- expected update style,
- when to replace content vs append,
- how the file relates to progressive disclosure.

Templates must remain repo-agnostic. They must not mention project-specific systems such
as particular doc folders, issue trackers, package managers, or local workflow doctrine.

This makes the template directory itself the editable policy surface for the extension:
changing template files changes future track generation without needing to touch storage
logic.

### 5.2 Track-local `AGENTS.md` (Rule of Clarity + Least Surprise)

`AGENTS.md` is the track entrypoint, not a dumping ground. It should function as a short
map, not a manual.

Proposed template sections:

1. **Purpose** — what this track/workstream is trying to achieve.
2. **Read this first** — recommended order: `summary.md`, `tasks.md`, `references.md`.
3. **File guide** — one line per track file.
4. **Update rules** — tracks can span multiple milestones; keep `summary.md` compressed; log only durable findings/decisions; keep `report.md` current while working in the track.
5. **Closeout rules** — close only when the broader workstream is truly done, then refresh summary and finalize `report.md` before marking the track closed.

The extension should inject or summarize this file when the current session is attached
to a track so the agent sees the task-local operating model without manually discovering it.

### 5.3 Progressive-disclosure references (Rule of Composition)

`references.md` is not a file inventory. It is a task-specific reading path.

Required sections:
- Read first
- Read when changing implementation
- Read when changing docs/process
- External resources (optional)

This keeps track-local context aligned with progressive disclosure: load the smallest
useful slice first, then drill deeper.

### 5.4 Context injection (Rule of Economy)

When the current session is attached to a track, the extension injects only a compact
task-local context before agent start.

Injected content should include:
- active track name,
- track purpose,
- `AGENTS.md` contents,
- `summary.md` contents.

It should not automatically inject:
- `findings.md`,
- `decisions.md`,
- `report.md`,
- full `references.md`,
- any file under `notes/` or `artifacts/`.

This preserves context budget while still giving the agent the task-local entrypoint and
current snapshot.

### 5.5 Sync model (Rule of Simplicity)

V1 sync should be deterministic. It should not depend on an LLM summarization step.

Minimal sync behavior:

- **Explicit**: `/track sync` and `track.sync` refresh deterministic snapshot outputs and
  `track.yaml.last_synced_at`.
- **Automatic**: on `session_shutdown`, if a track is active, refresh the deterministic
  snapshot.

V1 should avoid rewriting every file after every turn. That would create noisy diffs and
make the behavior harder to trust.

Minimal snapshot generation should:
- update `summary.md` with the current state and next-step snapshot using deterministic
  structure,
- update `track.yaml.updated_at` and `last_synced_at`,
- leave `findings.md` and `decisions.md` untouched unless explicitly updated,
- not attempt free-form AI-authored report generation.

`report.md` is still expected to change during the task, but in v1 that happens because
track-local instructions tell agents to keep it current, not because sync rewrites it.

### 5.6 `track end` closeout (Rule of Repair + Extensibility)

`track end` should close the task workspace cleanly without mutating files outside
`.pi/tracks/`, except for the mirrored session trace entry.

Minimal close flow:
1. ensure the active track exists,
2. run a final sync,
3. finalize the already-live `report.md` with a closeout section/checklist,
4. set `track.yaml.status = closed`,
5. set `closed_at`,
6. clear the active track binding if the closed track was active,
7. append a session custom entry reflecting the closure.

The output should explicitly say that the track is closed and that any follow-up work
outside `.pi/tracks/` is intentionally out of scope for this extension. Full promotion or
integration automation is deferred.

### 5.7 Tool and command surface

#### Slash command

Primary command: `/track`

Minimal subcommands:
- `/track new <name> --purpose "..."`
- `/track use <name>`
- `/track status`
- `/track list`
- `/track sync`
- `/track end`

#### Tool

Tool name: `track`

Minimal actions:
- `list`
- `get`
- `create`
- `set-active`
- `status`
- `sync`
- `end`

The tool and command should share the same storage/helpers layer.

### 5.8 Validation and error behavior

Tool boundary:
- TypeBox + `StringEnum` for `track` tool params.

Runtime/file boundary:
- Zod schemas for `track.yaml` and `settings.json` parsing.

Failure expectations:
- unknown track → clear error naming the track and available next steps,
- malformed `track.yaml` → clear repair message naming the file and invalid fields,
- session-attached track points to a missing directory → warning plus fix guidance,
- missing required track files → clear regeneration guidance.

## 6. Error handling and failure modes

- **Track already exists**: creation fails noisily and suggests `use` or a different name.
- **Track not found**: `use`, `sync`, `status`, and `end` return an actionable error.
- **Malformed metadata**: Zod parse errors are mapped to agent-legible messages.
- **Missing session-attached track**: `sync` and `end` explain that no track is attached to the current session.
- **Shutdown sync failure**: fail noisily in notification/logs, but do not block Pi exit.
- **Oversized summary drift**: `summary.md` template should instruct replacement/compression,
  not append-only growth.

## 7. Testing strategy

### 7.1 Unit tests

Add unit tests for:
- slug normalization,
- template directory copying/generation,
- metadata read/write round-trips,
- active-track settings persistence,
- session traceability entry creation/restoration helpers,
- error mapping for malformed track files,
- sync behavior for a synthetic track directory.

### 7.2 Tier 2 / extension-level tests

Where practical with shared mocks:
- `track` tool action behavior,
- active-track injection message generation,
- session traceability entry behavior,
- session shutdown sync hook behavior.

### 7.3 Manual verification

Manual checks in a live Pi session:
- create a track,
- attach to it,
- verify active context loads,
- confirm track-local instructions tell the agent to keep `report.md` current,
- edit work context,
- run `/track sync`,
- exit session and verify snapshot refresh,
- run `/track end` and verify report, session trace entry, and metadata closure.

## 8. Implementation checklist

- [ ] Create `extensions/tracks/` directory structure
- [ ] Add canonical markdown templates under `extensions/tracks/templates/`
- [ ] Define constants and schemas in `constants.ts` and `types.ts`
- [ ] Implement file I/O, template copying, and parsing in `storage.ts`
- [ ] Implement snapshot/helper logic in `helpers.ts`
- [ ] Implement `track` tool in `tool.ts`
- [ ] Implement `/track` command and hooks in `index.ts`
- [ ] Write `extensions/tracks/README.md`
- [ ] Add automated tests
- [ ] Run `bun test extensions/tracks`
- [ ] Run `bun run check`
- [ ] Manually verify in a live Pi session

## 9. Resolved decisions carried into v1

1. **Deterministic sync only in v1.** `summary.md` syncing should not use an LLM summarization step.
2. **Session-local runtime binding with mirrored project state.** `.pi/tracks/settings.json` remembers the latest project-level selection, but the session custom entry is the authority for the current session's attached track, UI restoration, and hook behavior.
3. **Live `report.md`.** `report.md` should be updated during work and finalized on `track end`, rather than being generated only at closeout.
