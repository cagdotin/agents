# QMD Extension — References

Collected 2026-05-18.

## Live docs cleaned

References removed or rewritten in:
- `lib/extension-runtime/conditional-feature.md`
- `.graveyard/extensions/README.md` (added retirement entry)

## Live source removed

Deleted source tree:
- `extensions/qmd/`

## Notes on package manifest

`package.json` did not need a targeted manifest change because Pi discovers extensions from the shared `./extensions` path.

No `@tobilu/qmd` dependency removal was needed because the extension lazy-loaded it and it was not declared in this repo's current `package.json`.

## Historical references intentionally left in place

Left as historical record where appropriate:
- archived/graveyard docs that mention QMD or compare it with retired systems
- unrelated uses of the English word “qmd” are not cleanup targets
