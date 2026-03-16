# QMD Panel Split-Pane Redesign — Agent Prompt

## Task

Redesign the QMD TUI panel from a single-column sequential drill-in UI into a persistent two-column split-pane layout with interactive search.

## Before You Start

Read these files in order. Do not write any code until you've read all of them:

1. **`docs/specs/2026-03-16-qmd-panel-split-pane-implementation.md`** — Your primary guide. Contains exact code snippets, file-by-file instructions, and verification steps for all 8 milestones.
2. **`docs/specs/2026-03-16-qmd-panel-split-pane-redesign.md`** — The design spec. Layout mockups, focus model, keyboard shortcuts, resolved questions. Reference when the implementation spec doesn't answer a design question.
3. **`docs/exec-plans/active/2026-03-16-qmd-panel-split-pane-redesign.md`** — The execution plan. Update the `Progress` section as you complete milestones. Log any surprises in `Surprises & Discoveries`.

Then read the source files you'll be modifying:

4. **`extensions/qmd/ui/panel.ts`** — The current panel (~680 lines). You are rewriting this file.
5. **`extensions/qmd/ui/data.ts`** — Snapshot types and file tree utilities. You'll add search result types.
6. **`extensions/qmd/ui/constants.ts`** — Panel dimensions. You'll update these.
7. **`extensions/qmd/core/qmd-store.ts`** — QMD SDK wrapper. You'll add search functions.
8. **`extensions/qmd/extension/command.ts`** — Wires callbacks. You'll add search/embed callbacks.

For the Pi TUI API, read: `/Users/cgn/.local/share/mise/installs/node/23.3.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md`

## How to Work

**One milestone at a time, in order.** The implementation spec defines 8 milestones:

1. Split-pane frame and sidebar rendering
2. Focus model and input routing
3. Overview in main pane
4. Files view in main pane
5. Search SDK wrappers
6. Search view — input and lex results
7. Search view — hybrid mode and polish
8. Footer, docs, and cleanup

For each milestone:
- Read its section in the implementation spec
- Write the code
- Run `bun run check` — must pass with no type errors
- Manually verify the behavior described in the "Verify" section
- Update `Progress` in the exec plan
- Commit

Do not skip ahead. Each milestone builds on the previous one.

## Key Rules

- **Do not modify** `extensions/qmd/ui/toggle-state.ts` or `extensions/qmd/ui/plain-text.ts`
- **Search is collection-scoped only.** When "All" is selected in the sidebar, search is unavailable (`s`/`/` does nothing). No global search.
- **`enter` on a search result copies the path to clipboard** (`pbcopy` on macOS)
- **Every line from `render()` must not exceed `width`.** Use `truncateToWidth()` on all output.
- **Use `theme.fg()` for all colors.** Never hardcode ANSI escapes.
- **Reuse existing helpers** (`render_card`, `section_header`, `status_badge`, `format_relative_time`, `display_key`, `pad_to_width`, `get_printable_char`) — adapt width params but don't rewrite them.
- **`show_qmd_panel()` function signature stays stable.** Callbacks grow additively.
- **Package manager: Bun.** Use `bun run check`, `bun test`, never npm/yarn/pnpm.
