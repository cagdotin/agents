# Workstream: tracks-extension (merged)

Source track: `.pi/tracks/track-extension/` (merged into `agent-memory`)

## Status

- Minimal tracks extension is implemented and validated.
- Session-trace authority bug was fixed (session trace is authoritative over shared settings).
- Remaining open work is milestone 2 lifecycle/status polish.

## Kept findings

- `summary.md` is derived; source files should be edited and then synced.
- `.pi/tracks/settings.json` stores latest project-level selection only; current session behavior must follow session trace.
- Template files under `extensions/tracks/templates/` are the right policy surface for repo-agnostic behavior.
- Deterministic sync is sufficient for current schema and keeps summaries diffable.

## Kept decisions

- Track policy should stay template-driven, not hidden in inline strings.
- Deterministic summary generation stays LLM-free.
- Tracks are workstream contexts, not one-shot task folders.
- Runtime track attachment must resolve from session trace entries.

## Open tasks carried into agent-memory

- Implement milestone 2 deterministic summary/status improvements.
- Land runtime-state hygiene for `.pi/tracks/settings.json` formatting checks.
- Re-validate with `bun test extensions/tracks` and `bun run check`.

## References

- `docs/specs/2026-03-11-tracks-extension-minimal-v1.md`
- `docs/exec-plans/active/2026-03-11-tracks-extension-minimal-v1.md`
- `docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- `docs/exec-plans/active/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- `extensions/tracks/README.md`
