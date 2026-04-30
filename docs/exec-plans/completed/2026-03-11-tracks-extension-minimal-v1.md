# Tracks extension — minimal implementation plan

Status: Completed
Owner: agent
Created: 2026-03-11
Spec: [[docs/specs/2026-03-11-tracks-extension-minimal-v1.md]]

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

This plan conforms to `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

After this work, a user can create a workstream-scoped track under `.pi/tracks/`, attach a
Pi session to it, and rely on a standardized local `AGENTS.md` plus compressed markdown
snapshots to resume work without replaying old chat history. Every track will look the
same, explain itself the same way, and support a small command/tool surface for creation,
selection, syncing, status inspection, and closeout.

The extension must be repo-agnostic: generated files and runtime behavior should assume
nothing about the surrounding repository beyond the existence of `.pi/tracks/`.

User-visible verification:
- `/track new ...` creates a canonical folder with all expected files.
- `/track use ...` marks a track active for the project and causes task-local context to
  load automatically in subsequent agent runs.
- `/track sync` refreshes the snapshot and metadata.
- Exiting the session refreshes the snapshot automatically.
- `/track end` finalizes the report and closes the track.

## Progress

- [x] (2026-03-11 17:35 CET) Discovery completed: reviewed repository planning standards and the Unix philosophy resource; confirmed minimal scope should exclude `.pi/todos/` coupling and handoff history.
- [x] (2026-03-11 17:42 CET) Planning artifacts created: spec + ExecPlan for minimal tracks extension.
- [x] (2026-03-11 18:02 CET) Plan revised after user feedback: template policy moved to `extensions/tracks/templates/`, sync made deterministic, active-track state split into settings + session traceability, and `report.md` changed to a live rolling artifact.
- [x] (2026-03-11 18:12 CET) Plan revised again to make repo-agnostic scope explicit: the extension manages only `.pi/tracks/` and must not assume any project-specific structure outside it.
- [x] (2026-03-11 18:41 CET) Milestone 1 complete: scaffolded `extensions/tracks/` with constants, schemas, template directory, storage layer, and deterministic YAML/JSON parsing.
- [x] (2026-03-11 18:45 CET) Milestone 2 complete: implemented the `track` tool and `/track` command for create/list/use/status/sync/end on top of shared helpers/storage.
- [x] (2026-03-11 18:47 CET) Milestone 3 complete: added active-track settings persistence, session trace entries, before-agent context injection, footer status restore, and shutdown sync.
- [x] (2026-03-11 19:44 CET) Milestone 4 complete: README, templates, tests, repo validation, scripted verification, and live Pi verification all passed, including the shutdown-sync rerun after the session-local binding fix.

## Surprises & Discoveries

- Observation: The extension must be isolated from repository-specific structure.
  Evidence: user explicitly asked that the extension be usable in any repository and manage only `.pi/tracks/`.

- Observation: Existing local extensions are not the right normative reference for this feature.
  Evidence: user explicitly rejected using `todos`/`expert` as state-of-the-art implementation references and reframed tracks as a purpose-built file-format manager with its own policy surface.

- Observation: `summary.md` works best as a generated artifact, not a lightly templated note file.
  Evidence: once the storage/helpers layer existed, deterministic sync could reliably rebuild `summary.md` from `tasks.md`, `findings.md`, `decisions.md`, `report.md`, and `track.yaml`, which made manual editing of the snapshot unnecessary.

- Observation: Project-level memory and current-session authority must be separated.
  Evidence: live Pi testing showed that using `.pi/tracks/settings.json` as the runtime authority caused one session to inject and sync the wrong track; session trace entries must drive current-session behavior while settings only remember the latest project-level selection.

- Observation: The file-backed workflow is usable even outside a live Pi session because the core behavior sits in storage/helpers rather than command glue.
  Evidence: a quick scripted demo using the extension modules successfully exercised create → activate → sync → end, including summary generation, closeout reporting, and active-binding clearing.

- Observation: Live Pi testing exposed a session-binding bug that the scripted demo could not catch.
  Evidence: a shutdown-sync pass updated `shutdown-demo/report.md` but left `shutdown-demo/summary.md` stale, which traced back to hook/default-track resolution using `.pi/tracks/settings.json` instead of the session's own trace entries.

- Observation: Repository quality gates already cover the new extension shape cleanly.
  Evidence: `bun run check` passed after adding the new extension, README, templates, tests, and hook/tool wiring.

## Decision Log

- Decision: Make track-local `AGENTS.md` the track entrypoint.
  Rationale: A short track-local map applies progressive disclosure at the workstream level instead of injecting a pile of files into context.
  Date/Author: 2026-03-11 / user + agent

- Decision: Use a canonical generated folder structure rather than free-form notes.
  Rationale: This follows Unix Rules of Generation, Least Surprise, and Representation: encode the workspace shape and file meanings as data/templates so program logic stays simple and every track behaves predictably.
  Date/Author: 2026-03-11 / user + agent

- Decision: Exclude external task-system coupling from v1.
  Rationale: The user wants the new workflow self-contained and repo-agnostic. A track-local `tasks.md` keeps the minimal version isolated.
  Date/Author: 2026-03-11 / user + agent

- Decision: Exclude multi-handoff tracking from v1.
  Rationale: Handoff semantics become ambiguous once many agents work on the same track. The minimal version should focus on snapshots and next-step clarity, not handoff history design.
  Date/Author: 2026-03-11 / user + agent

- Decision: Prefer explicit sync plus shutdown sync over per-turn rewriting.
  Rationale: This keeps the system simple, inspectable, and less noisy while still meeting the user's desire for automatic end-of-session updates.
  Date/Author: 2026-03-11 / agent

- Decision: Treat `extensions/tracks/templates/` as the policy surface for new track files.
  Rationale: The user wants literal markdown templates copied into tracks rather than template strings hidden in code. This keeps the system transparent, editable, and aligned with Unix Rules of Generation and Representation.
  Date/Author: 2026-03-11 / user + agent

- Decision: Keep sync deterministic in v1.
  Rationale: The user explicitly chose to avoid LLM-generated summarization for `summary.md` in the minimal version.
  Date/Author: 2026-03-11 / user + agent

- Decision: Persist the latest project-level selection in settings, but use session trace entries as the authority for the current session's attached track.
  Rationale: Settings provide continuity across sessions, but runtime hooks and command defaults must follow the session-local binding to avoid cross-session interference.
  Date/Author: 2026-03-11 / user + agent

- Decision: Keep `report.md` live during execution and finalize it on closeout.
  Rationale: The user wants the report to evolve with the work rather than appear only at `track end`. Track-local instructions should remind agents to keep it current.
  Date/Author: 2026-03-11 / user + agent

- Decision: Keep the extension isolated to `.pi/tracks/` plus mirrored session trace entries.
  Rationale: The user explicitly wants the feature unopinionated about repository structure. The extension should not assume project docs, planning folders, issue trackers, or any other file layout outside the track runtime area.
  Date/Author: 2026-03-11 / user + agent

## Outcomes & Retrospective

Planning outcome:
- The minimal version is now scoped tightly enough to implement as a standalone extension without inventing a multi-agent orchestration layer.
- The track-local `AGENTS.md` plus `summary.md` boot path is the core product idea; everything else in v1 should support that path.

Implementation retrospective so far:
- Deterministic snapshot syncing was straightforward to implement and test because the track file set is small and the summary can be rebuilt from simple markdown extraction rules.
- The generated templates keep repo-specific assumptions out of the extension code, which makes the workspace shape legible and portable.
- A scripted file-backed demo confirmed the core create → activate → sync → end workflow, including summary generation, closeout behavior, and active-binding clearing.
- Live Pi testing revealed that project-level settings are the wrong authority for an already-running session; session trace entries must win for runtime binding, hook behavior, and command defaults.
- The shutdown-hook rerun passed after the session-local binding fix: the updated `report.md` content appeared in `shutdown-demo-2/summary.md` under `Report pulse` without an explicit manual sync.

## Context and orientation

### Why this plan exists

The extension needs to provide a task-local coordination layer contained inside
`.pi/tracks/`, without taking a position on the rest of the repository. The product shape
is a purpose-built file-format manager for task workspaces: plain files, canonical
templates, small command/tool surface, deterministic sync, and minimal lifecycle hooks.

### Design references

- `docs/resources/unix-philosophy-raymond.md` — design rules used to keep v1 simple,
  data-driven, composable, and transparent.
- `docs/specs/2026-03-11-tracks-extension-minimal-v1.md` — source-of-truth design
  contract for this feature.

### Implementation stance

No existing local extension is the normative reference implementation for `tracks`.
Generated files and runtime behavior must stay repo-agnostic and should manage only the
track runtime area plus mirrored session trace entries.

### New runtime area

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

## Plan of work

### Milestone 1: Scaffold the extension around clean interfaces

Create `extensions/tracks/` with separate modules for constants, storage, helpers, tool,
and entrypoint, plus a `templates/` directory containing the canonical markdown files to
copy into new tracks. Keep policy in template files and schemas; keep mechanism in
storage and command/tool code. This is the main Unix-Rule-of-Separation guardrail for the
feature.

Deliverables:
- `constants.ts`
- `types.ts`
- `templates/`
- `storage.ts`
- initial `helpers.ts`

### Milestone 2: Implement the file-backed user surface

Add the `track` tool and `/track` command. Both should share the same storage/helpers
layer, not duplicate file logic. V1 commands/actions are limited to create, list, use,
status, sync, and end. Neither surface should assume project-specific files or workflows
outside `.pi/tracks/`.

Deliverables:
- `tool.ts`
- `/track` command in `index.ts`
- renderers or compact textual output for tool results

### Milestone 3: Add active-track boot behavior

Implement project-local active-track persistence in `.pi/tracks/settings.json`, mirror
track activation/clearing into session custom entries for traceability, then add hooks so
the active track's task-local map (`AGENTS.md`) and current snapshot (`summary.md`) are
available before agent execution. Add a shutdown hook that performs a best-effort sync.
Keep all hook behavior scoped to track runtime state rather than repository-wide policy.

Deliverables:
- active track read/write helpers
- session custom entry helpers for activation/closure traceability
- `before_agent_start` injection
- `session_shutdown` sync hook

### Milestone 4: Documentation, tests, and manual verification

Write the extension README, add unit tests and any feasible Tier 2 tests, then run Bun
validation and manually verify the workflow in Pi.

Deliverables:
- `extensions/tracks/README.md`
- tests under `extensions/tracks/__tests__/`
- passing `bun test extensions/tracks`
- passing `bun run check`
- manual behavior notes in this plan

## Concrete steps

All commands run from repository root: `/Users/cgn/git/0xcgn/agents`

### Milestone 1

```bash
mkdir -p extensions/tracks/__tests__ extensions/tracks/templates
# Create constants.ts, types.ts, storage.ts, helpers.ts
# Add canonical markdown files under extensions/tracks/templates/
```

Expected result:
- `find extensions/tracks -maxdepth 2 -type f | sort` shows the new module files and template files.

### Milestone 2

```bash
# Create tool.ts and index.ts command wiring
bun test extensions/tracks
```

Expected result:
- tests execute without TypeScript/runtime errors from missing exports.

### Milestone 3

```bash
# Extend index.ts with hooks and active-track loading/sync behavior
bun test extensions/tracks
```

Expected result:
- tests confirm active-track injection payload and shutdown sync behavior.

### Milestone 4

```bash
# Write README.md and any remaining tests
bun test extensions/tracks
bun run check
```

Manual verification in Pi:
1. Start Pi in this repository.
2. Run `/track new demo --purpose "validate the tracks workflow"`.
3. Run `/track use demo`.
4. Trigger an agent turn and confirm task-local context is visible.
5. Confirm the generated files contain no project-specific assumptions outside `.pi/tracks/`.
6. Update `report.md` during work and confirm track-local instructions clearly tell the agent to keep it current.
7. Run `/track sync` and inspect `.pi/tracks/demo/summary.md` + `track.yaml`.
8. Run `/track end` and inspect `report.md`, session trace entry, and closed status.

## Validation and acceptance

Implementation is acceptable when all of the following are true:

1. `.pi/tracks/<slug>/` is generated with the canonical file set and directories.
2. `AGENTS.md` clearly explains file roles and read order.
3. Generated files contain no project-specific assumptions outside `.pi/tracks/`.
4. `/track use` persists the active track in `.pi/tracks/settings.json`.
5. Track activation and closure are mirrored into session custom entries for traceability.
6. Before-agent context injection includes the active track map and current summary, but
   does not dump the whole track folder.
7. `/track sync` updates summary metadata and `last_synced_at`.
8. Session shutdown performs a best-effort snapshot refresh.
9. `report.md` exists from track creation and is expected to be updated during work, then finalized on `/track end`.
10. `/track end` marks the track closed and clears active binding when appropriate.
11. `bun test extensions/tracks` passes.
12. `bun run check` passes.
13. Manual live-session verification confirms the basic create → use → sync → end loop.

## Idempotence and recovery

- Track generation must fail cleanly if the slug already exists; it must not partially
  overwrite an existing workspace.
- Re-running `/track sync` should be safe and only refresh snapshot/metadata.
- If `settings.json` points at a missing track, the extension should surface a repairable
  error and allow the user to choose another track.
- If shutdown sync fails, Pi exit should continue, but the error should be visible and the
  track should remain repairable by running `/track sync` manually.
- If a generated file is accidentally deleted, the recovery path should be a regeneration
  helper rather than manual reconstruction from memory.
- If the extension is used in a repository with no project docs or special conventions,
  it should still work unchanged because it only manages `.pi/tracks/`.

## Artifacts and notes

- 2026-03-11: Planning references reviewed — `skills/engineering/plan/SKILL.md`, `skills/engineering/plan/PLAN.md`,
  `docs/resources/unix-philosophy-raymond.md`, `docs/exec-plans/README.md`.
- 2026-03-11: Scope tightened so the extension remains repo-agnostic and only manages `.pi/tracks/` plus session trace entries.
- 2026-03-11: Spec created at `docs/specs/2026-03-11-tracks-extension-minimal-v1.md`.
- 2026-03-11: Plan revised to use on-disk templates, deterministic sync, settings + session traceability, and a live `report.md`.
- 2026-03-11: Implemented `extensions/tracks/` with tool/command/hook wiring, template-backed workspace generation, deterministic sync, and closeout handling.
- 2026-03-11: Added Tier 1/2 coverage for track storage and helper logic; `bun test extensions/tracks` passes.
- 2026-03-11: Full repository quality gate passes after the tracks extension changes (`bun run check`).
- 2026-03-11: Scripted demo verified create → activate → sync → end behavior in a temporary workspace, including summary generation and active-binding clearing.
- 2026-03-11: Created `.pi/tracks/track-extension/` as the ongoing working area for this feature and synced its current state.
- 2026-03-11: Live Pi testing exposed a session-binding bug in hook/default-track resolution; fixed runtime binding to follow session trace entries instead of repo settings for the current session.
- 2026-03-11: Live shutdown-sync rerun passed after the fix: `shutdown-demo-2/summary.md` picked up the pre-exit report note without an explicit `/track sync`.

## Interfaces and dependencies

### Required extension modules

- `index.ts` — extension entrypoint, command/tool registration, hooks.
- `tool.ts` — shared tool surface for the model.
- `storage.ts` — file I/O, settings persistence, metadata parsing.
- `templates/` — canonical markdown files copied into new tracks.
- `helpers.ts` — snapshot and formatting helpers.
- `types.ts` — TypeBox tool schemas and Zod runtime schemas.
- `constants.ts` — filenames, statuses, command names.

### Required external APIs/patterns

- `pi.registerTool()` and `pi.registerCommand()` for user/model actions.
- `pi.on("before_agent_start")` for context injection.
- `pi.on("session_start")` and/or session reconstruction logic for restoring track UI state from session trace entries.
- `pi.on("session_shutdown")` for automatic end-of-session sync.
- `pi.appendEntry()` for session-local track traceability.
- TypeBox + `StringEnum` at tool boundaries.
- Zod for `track.yaml` and `settings.json` runtime parsing.

### Expected long-term extension points

These are intentionally deferred in v1 but the module boundaries should leave room for them:
- multi-handoff recording,
- richer TUI track browser,
- sub-agent coordination metadata,
- optional integration with other task-tracking abstractions.
