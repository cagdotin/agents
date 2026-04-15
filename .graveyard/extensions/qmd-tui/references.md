# QMD TUI — References

## Source code deleted

- `extensions/qmd/ui/panel.ts` — interactive split-pane TUI panel (1,830 lines)
- `extensions/qmd/ui/data.ts` — snapshot builder, file tree, helpers (579 lines)
- `extensions/qmd/ui/constants.ts` — panel constants
- `extensions/qmd/ui/plain-text.ts` — non-TUI fallback summary
- `extensions/qmd/ui/toggle-state.ts` — pending toggle state for file inclusion
- `extensions/qmd/extension/command.ts` — slash commands, panel lifecycle, alias, shortcut
- `extensions/qmd/docs/panel.md` — panel documentation
- `extensions/qmd/__tests__/ui/toggle-state.test.ts` — toggle state tests
- `extensions/qmd/__tests__/ui/data.test.ts` — data layer tests

## Live docs cleaned

- `extensions/qmd/README.md` — removed TUI panel section, `/qmd`/`/qp`/`Ctrl+Alt+Q` references, panel entries from file layout and docs index
- `extensions/qmd/docs/architecture.md` — removed UI layer section, `extension/command.ts` references, panel-related responsibilities

## Specs and exec-plans deleted (purely TUI-related)

- `docs/specs/2026-03-13-qmd-tui-panel.md` — original TUI panel spec
- `docs/specs/2026-03-16-qmd-panel-split-pane-redesign.md` — split-pane redesign spec
- `docs/specs/2026-03-16-qmd-panel-split-pane-implementation.md` — implementation spec
- `docs/specs/2026-03-16-qmd-multi-collection-selector.md` — multi-collection selector spec
- `docs/specs/2026-03-16-qmd-preview-agent-prompt.md` — preview panel feature spec
- `docs/specs/2026-03-16-qmd-panel-split-pane-agent-prompt.md` — panel agent prompt spec
- `docs/exec-plans/completed/2026-03-16-qmd-panel-split-pane-redesign.md` — completed exec plan
- `docs/exec-plans/completed/2026-03-16-qmd-multi-collection-selector.md` — completed exec plan

## Cross-cutting references left as historical record

- `.pi/tracks/agent-memory/exec-plans/qmd-tui-panel.md` — agent-memory track exec plan (historical)
- `.pi/tracks/agent-memory/report.md` — implementation report mentions panel features (historical)
- `.pi/tracks/agent-memory/specs/qmd-extension-v1.md` — v1 spec references panel (historical)
- `.pi/tracks/agent-memory/specs/qmd-file-tree-toggle.md` — file tree toggle spec (historical)
- `.graveyard/expertise/extensions-dev.yaml` — mentions QMD panel TUI pattern (historical)

## DIY files updated

- `extensions/qmd/diy/qmd-extension-snapshot-spec.md` — references to panel commands and TUI left as-is (DIY blueprint describes a point-in-time snapshot)
- `extensions/qmd/diy/qmd-extension-diy-execution-plan.md` — same
