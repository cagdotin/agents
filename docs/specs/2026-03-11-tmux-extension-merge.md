# Tmux Extensions — Merge tmux-notify + tmux-pane-title into One Extension

Status: Draft
Date: 2026-03-11
Execution plan: [[docs/exec-plans/active/2026-03-11-tmux-extension-merge.md]]

## 1. Problem statement

Two separate extensions — `tmux-notify` and `tmux-pane-title` — both target tmux integration but live as independent extensions. This causes:

- Duplicate shared code: `is_tmux()`, `tmux()`, `escape_tmux()`, and `pane_id` capture are copy-pasted identically in both.
- Two extension slots in the runtime for what is logically one domain.
- No shared tmux lifecycle (both independently check for tmux, both capture `pane_id`).

These should be a single `tmux` extension with sub-modules, following the same consolidation pattern used for the GitHub skill merge.

## 2. Goals and non-goals

### 2.1 Goals

- Merge `tmux-notify` and `tmux-pane-title` into a single `extensions/tmux/` extension.
- Extract shared tmux helpers into a `shared.ts` module.
- Preserve all existing behavior identically — no functional changes.
- Single `index.ts` entry point that checks tmux once, captures `pane_id` once, and initializes both sub-modules.
- Combined README documenting both capabilities.
- Delete `extensions/tmux-notify/` and `extensions/tmux-pane-title/` after merge.
- Update `docs/ARCHITECTURE.md` to reflect the new structure.

### 2.2 Non-goals

- Adding new tmux features or changing behavior.
- Changing the notification sound, badge character, or pane title format.
- Cross-extension dependencies (this is consolidation within one extension).

## 3. System context

### Affected modules

- `extensions/tmux-notify/` — will be deleted (logic moves to `extensions/tmux/notify.ts`)
- `extensions/tmux-pane-title/` — will be deleted (logic moves to `extensions/tmux/pane-title.ts`)
- `extensions/tmux/` — new unified extension
- `docs/ARCHITECTURE.md` — codemap references both old extensions by name

### Key difference from the GitHub skill merge

Skills are static markdown with a router pattern. Extensions are **runtime code** — the merge must handle:
- Shared helper extraction (not just file moves)
- A single `export default function` entry point that composes both sub-modules
- Shared state (`pane_id`) passed from the entry point to sub-modules

## 4. Detailed design

### 4.1 Target structure

```
extensions/tmux/
├── index.ts         # Entry point: tmux guard, pane_id capture, compose sub-modules
├── shared.ts        # Shared helpers: is_tmux, tmux, escape_tmux
├── notify.ts        # Notification badge + sound logic
├── pane-title.ts    # Pane title management logic
└── README.md        # Combined documentation
```

### 4.2 `shared.ts` — Extracted helpers

Three functions that are currently duplicated verbatim:

- `is_tmux(): boolean` — checks `process.env.TMUX`
- `tmux(cmd: string): string` — runs a tmux command, swallows errors
- `escape_tmux(str: string): string` — escapes single quotes for tmux

These become named exports from `shared.ts`.

### 4.3 `index.ts` — Entry point

```typescript
export default function (pi: ExtensionAPI) {
  if (!is_tmux()) return;

  const pane_id = tmux("display-message -p '#{pane_id}'");
  if (!pane_id) return;

  register_notify(pi, pane_id);
  register_pane_title(pi, pane_id);
}
```

Key design decision: `pane_id` is captured once and passed to both sub-modules. This eliminates the duplicate tmux call at startup and ensures both features target the same pane.

### 4.4 `notify.ts` — Notification sub-module

Exports a single function: `register_notify(pi: ExtensionAPI, pane_id: string): void`

Contains all logic from current `tmux-notify/index.ts` except:
- The tmux guard (`is_tmux()` check) — handled by `index.ts`
- The `pane_id` capture — received as parameter
- The duplicate helper functions — imported from `shared.ts`

### 4.5 `pane-title.ts` — Pane title sub-module

Exports a single function: `register_pane_title(pi: ExtensionAPI, pane_id: string): void`

Contains all logic from current `tmux-pane-title/index.ts` except:
- The tmux guard — handled by `index.ts`
- The `pane_id` capture — received as parameter
- The duplicate helper functions — imported from `shared.ts`

### 4.6 README.md

Combined documentation covering both capabilities:
- Notification badge + sound behavior
- Pane title format and `@pi_title` mechanism
- Required/optional tmux config (both pane-border-format and bell settings)
- Requirements (tmux, macOS for sound)

## 5. Testing strategy

### 5.1 Validation

- `bun run check:docs` passes (README present)
- `bun run check` passes when tree is otherwise clean
- Manual smoke test: run pi inside tmux, verify both badge notifications and pane titles work

### 5.2 No unit tests

Both existing extensions have no tests. The merge is a structural refactor with no behavior change — adding tests is a separate concern.

## 6. Implementation checklist

- [ ] Create `extensions/tmux/` directory
- [ ] Create `extensions/tmux/shared.ts` with extracted helpers
- [ ] Create `extensions/tmux/notify.ts` (refactored from tmux-notify)
- [ ] Create `extensions/tmux/pane-title.ts` (refactored from tmux-pane-title)
- [ ] Create `extensions/tmux/index.ts` (entry point composing both)
- [ ] Create `extensions/tmux/README.md` (combined docs)
- [ ] Delete `extensions/tmux-notify/`
- [ ] Delete `extensions/tmux-pane-title/`
- [ ] Update `docs/ARCHITECTURE.md` codemap
- [ ] Run `bun run check`

## 7. Open questions

None — this is a straightforward structural refactor.
