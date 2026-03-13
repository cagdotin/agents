# QMD Extension

Repo-local QMD infrastructure for Pi.

## What it does

- Detects whether the current repo is indexed by QMD
- Tracks repo freshness via `.pi/qmd.json`
- Adds a quiet footer for indexed repos only
- Injects short guidance so the agent knows when to use `qmd query/search/get` via `bash`
- Provides an interactive TUI panel (`/qmd`, `/qp`, `Ctrl+Alt+Q`) showing:
  - Binding status, freshness, document count, contexts, stale files
  - File browser for all indexed documents
  - In-panel update (`u` key) and init (`i` key) actions
- Provides subcommands: `/qmd status`, `/qmd update`, `/qmd init`

## What it does not do

- It does **not** expose an always-on search tool
- It does **not** intercept or rewrite search queries automatically
- It does **not** mirror QMD config into repo files

The extension owns infra and workflow. The agent still uses the QMD CLI directly for retrieval.

## Source of truth

- **QMD store** — collections and path contexts
- **`.pi/qmd.json`** — repo binding and freshness marker only

## Commands

### `/qmd` (no args) · `/qp` · `Ctrl+Alt+Q`
Opens the QMD index dashboard panel. Shows binding status, freshness, index stats, path contexts, and stale files in an interactive TUI overlay. See `docs/panel.md` for keyboard shortcuts and panel states.

When `hasUI` is false, prints a plain-text summary instead.

### `/qmd status`
Shows current repo state only:
- indexed / not indexed / unavailable
- repo root
- collection key
- freshness state
- repair notes when marker/store drift is detected

### `/qmd update`
Updates the **current repo collection only**.
It never reindexes all collections by default.

### `/qmd init`
Starts a deterministic onboarding flow:
1. scan repo
2. build draft proposal
3. let the agent refine it with the user
4. execute `qmd_init` only after explicit confirmation

## Setup

This repo currently expects the local QMD fork to be linked via Bun:

- package: `@tobilu/qmd`
- local fork: `~/git/qmd-fork`
- link style: `bun link`

## File layout

```
extensions/qmd/
├── index.ts                    # Extension entry point
├── core/
│   ├── errors.ts               # Agent-legible typed errors
│   ├── qmd-store.ts            # SDK wrapper with lazy lifecycle
│   └── types.ts                # Zod schemas + TypeBox tool params
├── domain/
│   ├── freshness.ts            # Git-based markdown freshness
│   ├── onboarding.ts           # Deterministic init pipeline
│   └── repo-binding.ts         # Repo root, collection key, marker I/O
├── extension/
│   ├── command.ts              # Slash commands, alias, shortcut, panel lifecycle
│   ├── runtime.ts              # Session hooks, footer, prompt injection
│   └── tool.ts                 # Workflow-scoped qmd_init tool
├── ui/
│   ├── constants.ts            # Panel constants (width, shortcuts, icon)
│   ├── data.ts                 # Snapshot builder, file tree, helpers
│   ├── panel.ts                # Interactive TUI panel (overview/files/updating)
│   └── plain-text.ts           # Non-TUI fallback summary
├── docs/
│   ├── architecture.md         # Layer diagram and responsibilities
│   ├── freshness.md            # Freshness model and footer behavior
│   ├── onboarding.md           # Init flow steps and caveats
│   └── panel.md                # Panel states, keyboard shortcuts, data flow
└── __tests__/
    ├── core/
    │   ├── qmd-store.test.ts
    │   └── types.test.ts
    ├── domain/
    │   ├── freshness.test.ts
    │   ├── onboarding.test.ts
    │   └── repo-binding.test.ts
    ├── extension/
    │   └── runtime.test.ts
    └── ui/
        └── data.test.ts
```

## Docs

- `docs/architecture.md` — layers, dependency direction, file responsibilities
- `docs/onboarding.md` — init flow steps and caveats
- `docs/freshness.md` — freshness model and footer behavior
- `docs/panel.md` — panel states, keyboard shortcuts, data flow
