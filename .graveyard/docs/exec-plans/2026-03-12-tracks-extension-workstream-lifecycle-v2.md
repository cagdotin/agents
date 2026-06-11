# Tracks extension — workstream lifecycle and runtime-state hygiene

Status: Active
Owner: agent
Created: 2026-03-12
Spec: [[docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md]]

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

This plan conforms to `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

After this milestone, the `tracks` extension will better express what a track actually is:
an ongoing workstream context rather than a one-shot task folder. Deterministic
`summary.md` output will surface phase, open threads, and milestones more clearly, and
repo-wide formatter checks will stop failing on `.pi/tracks/settings.json`, which is
mutable runtime state rather than source code.

User-visible verification:
- `summary.md` shows current phase, open threads, and milestones in deterministic form.
- `track status` output surfaces current phase when present.
- attaching a track updates `.pi/tracks/settings.json` without making `bun run check:biome`
  fail.

## Progress

- [x] (2026-03-12 08:25 CET) Milestone 2 planning created from the current track discussion and the resolved runtime-state policy decision.
- [ ] (2026-03-12 08:35 CET) Milestone 1: implement section-aware deterministic summary extraction and bump summary version.
- [ ] (2026-03-12 08:50 CET) Milestone 2: improve status output and user-facing wording for workstream semantics.
- [ ] (2026-03-12 09:00 CET) Milestone 3: exclude `.pi/tracks/settings.json` from Biome checks and validate the quality-gate behavior.
- [ ] (2026-03-12 09:10 CET) Milestone 4: run tests/checks, update the active track docs, and decide what milestone 3 should be.

## Surprises & Discoveries

- Observation: The product semantics have already moved ahead of the deterministic summary format.
  Evidence: `tasks.md` and `report.md` now encode `Current phase`, `Open threads`, and `Milestones`, but the generated summary still flattens most of that into generic sections.

- Observation: The runtime-state formatting issue is narrow.
  Evidence: the concrete failure was on `.pi/tracks/settings.json`, not on the extension source or template files.

## Decision Log

- Decision: Exclude `.pi/tracks/settings.json` from formatter-driven quality gates.
  Rationale: It is mutable runtime state, not source code, and should not fail repo-wide formatting checks.
  Date/Author: 2026-03-12 / user + agent

- Decision: Use milestone 2 to reinforce workstream semantics rather than expanding scope into handoffs or sub-agent features.
  Rationale: This follows directly from the user correction that tracks persist across multiple milestones and should not close after one implementation pass.
  Date/Author: 2026-03-12 / user + agent

## Outcomes & Retrospective

(to be filled during implementation)

## Context and orientation

### Why this plan exists

Milestone 1 proved the core file-backed architecture. The next gap is semantic and
operational polish: the extension should better represent ongoing workstreams in its
summary/status outputs, and repo checks should stop treating runtime settings as a source
file formatting failure.

### Relevant files

- `extensions/tracks/helpers.ts` — deterministic summary generation and closeout helpers.
- `extensions/tracks/tool.ts` — tool descriptions and status serialization.
- `extensions/tracks/index.ts` — slash-command description if wording changes.
- `extensions/tracks/README.md` — user-facing behavior description.
- `extensions/tracks/templates/tasks.md` — source shape for phase/open-thread inputs.
- `extensions/tracks/templates/report.md` — source shape for milestone inputs.
- `extensions/tracks/__tests__/helpers.test.ts` — main summary/status regression coverage.
- `biome.json` — current formatter input configuration.

## Plan of work

### Milestone 1: section-aware deterministic summary extraction

Teach the summary builder to read specific named sections rather than scanning the full
markdown loosely. Bump the summary version because the generated artifact structure is
changing in a meaningful way.

Deliverables:
- named-section extraction helpers
- updated v2 summary structure
- summary version bump
- tests for current phase/open threads/milestones

### Milestone 2: status and wording polish

Expose current phase in status output and align any remaining user/model-facing wording so
tracks read as ongoing workstreams rather than completed-task containers.

Deliverables:
- updated status serialization
- any necessary README / description tweaks

### Milestone 3: runtime-state formatter exclusion

Narrowly exclude `.pi/tracks/settings.json` from Biome checks, then prove the runtime
settings file no longer trips formatter failures after track attachment.

Deliverables:
- `biome.json` update
- manual verification notes

### Milestone 4: validation and track refresh

Run tests and repo checks, then update the active `track-extension` track artifacts so
its summary/report/tasks reflect the completed milestone 2 work and leave the next
milestone decision visible.

Deliverables:
- passing `bun test extensions/tracks`
- passing `bun run check`
- refreshed active track state

## Concrete steps

All commands run from repository root: `/Users/cgn/git/0xcgn/agents`

### Milestone 1

```bash
# Edit helpers.ts and tests
bun test extensions/tracks
```

Expected result:
- tests cover the new deterministic summary sections and pass.

### Milestone 2

```bash
# Edit tool.ts / README.md / any descriptions as needed
bun test extensions/tracks
```

Expected result:
- status output and wording align with workstream semantics.

### Milestone 3

```bash
# Edit biome.json to exclude .pi/tracks/settings.json
bun run check:biome
```

Expected result:
- `.pi/tracks/settings.json` no longer appears as a formatter failure.

### Milestone 4

```bash
bun test extensions/tracks
bun run check
```

Manual verification:
1. attach an active track so `.pi/tracks/settings.json` updates,
2. run `bun run check:biome`,
3. verify it stays green,
4. inspect `summary.md` / `track status` output for phase/open-thread/milestone visibility.

## Validation and acceptance

Implementation is acceptable when all of the following are true:

1. `summary.md` includes deterministic sections for current phase, open threads, and milestones.
2. the summary version is bumped to reflect the new layout.
3. `track status` output surfaces current phase when present.
4. `bun run check:biome` no longer fails on `.pi/tracks/settings.json` after normal track attachment.
5. `bun test extensions/tracks` passes.
6. `bun run check` passes.
7. the active `track-extension` workspace is refreshed to reflect milestone 2 completion or current progress.

## Idempotence and recovery

- Summary regeneration remains deterministic and safe to rerun.
- If section-aware parsing cannot find a heading, it should fall back gracefully instead of failing sync.
- If the Biome exclusion pattern is too broad, tighten it to the single runtime settings file rather than excluding more of `.pi/`.

## Artifacts and notes

- 2026-03-12: milestone 2 plan created after deciding that `.pi/tracks/settings.json` should be excluded from formatter checks.
- 2026-03-12: scope intentionally stays within lifecycle semantics and runtime-state hygiene; handoffs and orchestration remain deferred.

## Interfaces and dependencies

- `build_track_summary_markdown()` in `helpers.ts` remains the deterministic snapshot entrypoint.
- `serialize_track_for_agent()` remains the main compact status surface for tool/command output.
- `TRACK_SUMMARY_VERSION` in `constants.ts` should advance when the summary schema changes.
- `biome.json` remains the repo-level policy surface for formatter scope.
