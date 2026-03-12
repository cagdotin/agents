# Tasks

## Current phase

- Milestone 2 planning completed; next step is implementation of lifecycle semantics and runtime-state hygiene.

## Current tasks

- [ ] Implement milestone 2 deterministic summary/status improvements for workstream lifecycle semantics.
- [ ] Exclude `.pi/tracks/settings.json` from Biome formatting checks.
- [ ] Validate milestone 2 with `bun test extensions/tracks` and `bun run check`.

## Open threads

- How should the extension express milestone history without pushing users toward premature closure?
- Which UX improvements matter most next: status/browser polish, validation, or recovery commands?
- Should statuses stay `active|paused|closed`, or does a future milestone need richer lifecycle states?

## Next steps

- Implement the milestone 2 spec and execution plan.
- Re-sync this track once milestone 2 code/docs land.
- Then decide what milestone 3 should be for the tracks extension workstream.

## Done

- Updated track docs, templates, and runtime wording so tracks are positioned as ongoing workstream contexts rather than one-shot task folders.
- Decided the runtime-state policy: exclude `.pi/tracks/settings.json` from formatter checks.
- Wrote milestone 2 planning artifacts for workstream lifecycle semantics and runtime-state hygiene.
- Implemented the minimal tracks extension under `extensions/tracks/`.
- Added template-backed workspace generation, deterministic sync, active-track persistence, session trace entries, and shutdown sync.
- Added README and Tier 1/2 tests for storage and helper logic.
- Ran `bun test extensions/tracks` successfully.
- Ran `bun run check` successfully during the validated implementation pass.
- Ran a scripted create → use → sync → end demo in a temporary workspace and verified the expected outputs.
- Re-ran live Pi shutdown-sync verification after the session-local binding fix and confirmed `shutdown-demo-2/summary.md` picked up the pre-exit report note automatically.
