# Tmux Extension Merge — Execution Plan

Status: Completed
Owner: agent
Created: 2026-03-11
Spec: [[docs/specs/2026-03-11-tmux-extension-merge.md]]

This ExecPlan is a living document and must be maintained in accordance with `PLAN.md`.

## Purpose / Big picture

Consolidate `tmux-notify` and `tmux-pane-title` into a single `extensions/tmux/` extension with shared helpers and sub-modules, preserving all existing behavior.

## Progress

- [x] (2026-03-11 12:12) Step 1: Create `extensions/tmux/shared.ts`
- [x] (2026-03-11 12:12) Step 2: Create `extensions/tmux/notify.ts`
- [x] (2026-03-11 12:12) Step 3: Create `extensions/tmux/pane-title.ts`
- [x] (2026-03-11 12:12) Step 4: Create `extensions/tmux/index.ts`
- [x] (2026-03-11 12:12) Step 5: Create `extensions/tmux/README.md`
- [x] (2026-03-11 12:16) Step 6: Delete old extension directories — user deleted manually
- [x] (2026-03-11 12:12) Step 7: Update `docs/ARCHITECTURE.md`
- [x] (2026-03-11 12:12) Step 8: Run `bun run check` — all 434 tests pass, biome + docs clean

## Surprises & discoveries

- Observation: Damage-control extension blocks `rm` on README.md files and recursive deletes.
  Evidence: Both `rm -rf` and individual `rm` of README.md files were blocked.
  Resolution: User needs to manually delete `extensions/tmux-notify/` and `extensions/tmux-pane-title/`.

## Decision log

- Decision: Pass `pane_id` from index.ts to sub-modules rather than having each capture it.
  Rationale: Eliminates duplicate tmux call, guarantees both modules target the same pane.
  Date: 2026-03-11

- Decision: Sub-modules export `register_*` functions (not default exports or classes).
  Rationale: Matches `snake_case` naming convention. Simple function signature `(pi, pane_id)` keeps coupling minimal.
  Date: 2026-03-11

## Context and orientation

- `extensions/tmux-notify/index.ts` — 131 lines, badge + sound on agent_end
- `extensions/tmux-pane-title/index.ts` — 163 lines, pane title via @pi_title user option
- Three identical helper functions duplicated across both files
- Both capture `pane_id` independently at startup
- Gold-standard extension pattern: `extensions/todos/index.ts`

## Plan of work

### Step 1: Create `shared.ts`

Extract the three shared functions:
- `is_tmux()` — check `process.env.TMUX`
- `tmux(cmd)` — run tmux command, swallow errors
- `escape_tmux(str)` — escape single quotes

### Step 2: Create `notify.ts`

Move notification logic from `tmux-notify/index.ts`:
- Export `register_notify(pi: ExtensionAPI, pane_id: string): void`
- Import helpers from `./shared.js`
- Remove tmux guard and pane_id capture (handled by caller)
- All internal state (badge_active, original_name, timers, etc.) stays local to this module

### Step 3: Create `pane-title.ts`

Move pane title logic from `tmux-pane-title/index.ts`:
- Export `register_pane_title(pi: ExtensionAPI, pane_id: string): void`
- Import helpers from `./shared.js`
- Remove tmux guard and pane_id capture (handled by caller)
- All internal state (model_name, is_working, etc.) stays local to this module

### Step 4: Create `index.ts`

Thin entry point:
1. Guard: `if (!is_tmux()) return`
2. Capture `pane_id`
3. Call `register_notify(pi, pane_id)`
4. Call `register_pane_title(pi, pane_id)`

### Step 5: Create `README.md`

Merge both READMEs into one document covering both features.

### Step 6: Delete old directories

```bash
rm -rf extensions/tmux-notify extensions/tmux-pane-title
```

### Step 7: Update ARCHITECTURE.md

Replace the two separate bullet points with a single `tmux` entry.

### Step 8: Validate

```bash
bun run check
```

## Validation and acceptance

- `bun run check` passes
- Extension loads without error in tmux
- Both notification badge and pane title features work as before

## Idempotence and recovery

Low risk — if anything goes wrong, the old extension directories still exist until Step 6. Steps 1-5 create new files without touching originals. Step 6 (deletion) should only happen after validating Steps 1-5 work.
