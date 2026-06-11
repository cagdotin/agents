# Tracks extension — workstream lifecycle and runtime-state hygiene

Status: Draft
Date: 2026-03-12
Previous milestone: [[docs/specs/2026-03-11-tracks-extension-minimal-v1.md]]
Execution plan: [[docs/exec-plans/active/2026-03-12-tracks-extension-workstream-lifecycle-v2.md]]

## 1. Problem statement

The minimal `tracks` extension now works: it creates canonical workspaces, binds the
current session to a track via session trace entries, synchronizes deterministic
`summary.md`, and closes tracks cleanly. The latest design discussion clarified an
important semantic correction, though: **tracks are ongoing workstream contexts, not
one-shot task folders**.

That exposes two concrete gaps in the current implementation:

1. **The deterministic summary and status surfaces still skew task-like.** `tasks.md`
   now distinguishes `Current phase`, `Current tasks`, `Open threads`, and `Next steps`,
   and `report.md` now has a `Milestones` section, but the summary builder still flattens
   most of that structure into generic next-step/checklist output. The generated snapshot
   does not yet express the workstream model clearly enough.
2. **Repo quality gates still trip over runtime state.** `.pi/tracks/settings.json` is a
   mutable runtime file that remembers the latest project-level track selection. It is not
   source code, but the current Biome configuration still checks it, so `bun run check`
   can fail on a harmless formatting diff in mutable runtime state.

Desired end state for milestone 2:

- `summary.md` and track status surfaces clearly reflect ongoing workstream semantics.
- Deterministic sync remains LLM-free and repo-agnostic.
- `.pi/tracks/settings.json` is excluded from formatter-driven quality failures.
- The extension still manages only `.pi/tracks/` plus mirrored session trace entries.

## 2. Goals and non-goals

### 2.1 Goals

- Evolve deterministic track summaries to better represent workstream lifecycle state.
- Preserve the existing repo-agnostic contract: no assumptions about docs, issue
  trackers, or host-repo structure outside `.pi/tracks/`.
- Exclude `.pi/tracks/settings.json` from Biome formatting/checking so mutable runtime
  state does not fail repo-wide quality gates.
- Improve user/model-facing track status output so the current phase is visible without
  reading the entire track folder.
- Keep all behavior deterministic; no LLM summarization.

### 2.2 Non-goals

- No handoff history, sub-agent orchestration, or role assignment.
- No integration with `.pi/todos/`, project docs, external issue trackers, or any other
  system outside `.pi/tracks/`.
- No rich TUI browser in this milestone.
- No status-enum expansion unless implementation work proves it necessary.
- No migration of the extension away from the current file layout or storage model.

## 3. System context

Affected areas:

```text
extensions/tracks/
├── helpers.ts        # deterministic summary building + closeout helpers
├── tool.ts           # user/model-facing track descriptions + status output
├── index.ts          # slash-command descriptions if wording changes
├── README.md         # user-facing semantics
├── templates/
│   ├── AGENTS.md
│   ├── tasks.md
│   └── report.md
└── __tests__/
    ├── helpers.test.ts
    └── storage.test.ts

biome.json            # formatter/check inclusion policy
```

The current template/doc wording already moved toward workstream semantics, but the
runtime-generated summary still needs to catch up.

## 4. Domain model changes

### 4.1 `tasks.md` as lifecycle input

`tasks.md` already distinguishes multiple roles:
- `Current phase`
- `Current tasks`
- `Open threads`
- `Next steps`
- `Done`

Milestone 2 should treat these sections as first-class structured inputs to the
deterministic summary instead of flattening them through generic list extraction.

### 4.2 `report.md` milestones

`report.md` already has a `Milestones` section. Milestone 2 should expose this in the
summary so long-lived tracks can show progress without encouraging premature closure.

### 4.3 Summary version bump

Because the summary structure will change materially, bump `TRACK_SUMMARY_VERSION`.
This makes it obvious that the deterministic snapshot schema evolved between milestone 1
and milestone 2.

## 5. Detailed design

### 5.1 Section-aware deterministic parsing

Introduce heading-aware markdown extraction helpers in `helpers.ts` so the summary builder
can read specific sections instead of scanning the whole file generically.

Required support:
- extract list items from a named section (`Current tasks`, `Open threads`, `Next steps`,
  `Milestones`)
- extract a compact phase line from `Current phase`
- keep current fallback behavior when a section is missing

This should stay simple and purpose-built for the known track templates, not become a
full markdown parser.

### 5.2 Summary layout evolution

Update `build_track_summary_markdown()` so the generated snapshot better reflects
workstream semantics.

Proposed v2 summary shape:
- Snapshot
- Related paths
- Current phase
- Next steps
- Open checklist
- Open threads
- Findings
- Decisions
- Milestones
- Report pulse

Notes:
- `Current phase` can be a short bullet list or single bullet, depending on extracted
  content.
- `Milestones` should come from `report.md` first, not from ad-hoc scanning of the whole
  report.
- The summary should remain compressed; do not dump entire sections.

### 5.3 Status output improvement

Improve `serialize_track_for_agent()` (and any equivalent command output) so it surfaces
at least:
- track name
- purpose
- status
- whether this session is attached
- current phase, if available
- missing files / last synced

This gives users and agents a better at-a-glance status without needing to open
`summary.md` immediately.

### 5.4 Runtime-state formatting exclusion

Adjust `biome.json` so `.pi/tracks/settings.json` is excluded from formatter/check input.
The goal is narrow: remove mutable runtime state from repo-wide Biome failures without
weakening checks for extension source files.

Preferred scope:
- exclude only `.pi/tracks/settings.json`
- do not broadly exempt all `.pi/` JSON unless necessary

Acceptance criterion:
- a normal runtime update to `.pi/tracks/settings.json` should no longer make
  `bun run check:biome` fail.

### 5.5 Documentation alignment

Update user-facing docs where needed so they match the new runtime behavior:
- README wording for workstream semantics
- any tool/command descriptions that still imply "task folder" behavior
- templates only if the implementation learns something new about phase/milestone usage

## 6. Error handling and failure modes

- **Missing sections**: deterministic summary generation should degrade gracefully and use
  explicit fallback text.
- **Unexpected template edits**: if a user removes expected headings, the extension should
  still produce a valid summary rather than fail hard.
- **Biome exclusion too broad**: avoid accidentally excluding source-controlled JSON that
  should still be checked.

## 7. Testing strategy

### 7.1 Unit tests

Add/extend tests for:
- extracting named sections from `tasks.md` / `report.md`
- generating a v2 summary with `Current phase`, `Open threads`, and `Milestones`
- status serialization showing current phase when present

### 7.2 Validation checks

Manual validation for formatter policy:
1. attach a track so `.pi/tracks/settings.json` changes,
2. run `bun run check:biome`,
3. verify the runtime settings file no longer causes a failure.

### 7.3 Regression checks

- `bun test extensions/tracks`
- `bun run check`

## 8. Implementation checklist

- [ ] Bump summary version constant
- [ ] Add section-aware extraction helpers in `helpers.ts`
- [ ] Update deterministic summary layout for phase/open threads/milestones
- [ ] Improve track status serialization to surface current phase
- [ ] Narrowly exclude `.pi/tracks/settings.json` from Biome checks
- [ ] Update docs if implementation wording drifts
- [ ] Add/refresh tests
- [ ] Run `bun test extensions/tracks`
- [ ] Run `bun run check`
- [ ] Manually verify runtime settings no longer fail Biome

## 9. Open questions

1. Should current phase be shown only in `summary.md`, or also in `track status` output by default? Recommendation: yes, show it in both.
2. Should `Milestones` come only from `report.md`, or should `Done` items in `tasks.md` also feed it? Recommendation: use `report.md` as the milestone source to keep roles clear.
3. If Biome cannot cleanly exclude a single runtime file via config includes, should the fallback be to narrow the check script scope instead? Recommendation: prefer Biome config first; change scripts only if the config cannot express the exclusion cleanly.
