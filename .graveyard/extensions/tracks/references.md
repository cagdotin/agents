# Tracks Extension — References

Collected 2026-05-18.

## Live docs cleaned

References removed or rewritten in:
- `docs/ARCHITECTURE.md`
- `docs/exec-plans/README.md`
- `docs/references/pi-api-reference.md`
- `extensions/qmd/skills/qmd/SKILL.md`
- `extensions/qmd/__tests__/core/handelize.test.ts`
- `.graveyard/extensions/README.md` (added retirement entry)

## Specs / execution plans archived

Moved to graveyard because they were specific to the retired extension:
- `docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md` → `.graveyard/docs/specs/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`
- `docs/exec-plans/active/2026-03-12-tracks-extension-workstream-lifecycle-v2.md` → `.graveyard/docs/exec-plans/2026-03-12-tracks-extension-workstream-lifecycle-v2.md`

Already archived before retirement:
- `.graveyard/docs/specs/2026-03-11-tracks-extension-minimal-v1.md`
- `.graveyard/docs/exec-plans/2026-03-11-tracks-extension-minimal-v1.md`

## Historical references intentionally left in place

Left as historical record in runtime and archival material:
- `.pi/tracks/agent-memory/**`
- `.graveyard/docs/**` files that discuss tracks as prior architecture
- `.graveyard/expertise/tracks-extension.yaml`

## Source deleted

Deleted live source tree:
- `extensions/tracks/`

## Notes

`package.json` did not need a targeted manifest change because Pi discovers extensions from the shared `./extensions` path rather than from a per-extension registration list.
