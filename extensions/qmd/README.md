# QMD Extension

Repo-local QMD infrastructure for Pi.

## What it does

**When indexed** (`features/indexed.ts`, conditional feature):
- Exposes the QMD skill via `resources_discover`
- Injects a system prompt hint so the agent knows when to use `qmd query/search/get`
- Sets a quiet footer status with freshness info
- Refreshes binding and freshness on session events

**Always available** (`commands/init.ts`):
- `/qmd init` command to onboard a new repository
- `qmd_init` tool (deactivated by default, activated by the command)

**Shared** (`index.ts`):
- Closes the QMD store on `session_shutdown`

## What it does not do

- It does **not** expose an always-on search tool
- It does **not** intercept or rewrite search queries automatically
- It does **not** mirror QMD config into repo files

The extension owns infra and workflow. The agent still uses the QMD CLI directly for retrieval.

## Source of truth

- **QMD store** — collections and path contexts
- **`.pi/qmd.json`** — repo binding and freshness marker only

## Setup

This repo currently expects the local QMD fork to be linked via Bun:

- package: `@tobilu/qmd`
- local fork: `~/git/qmd-fork`
- link style: `bun link`

## File layout

```
extensions/qmd/
├── index.ts                    # Entry point — feature + command registration, store lifecycle
├── detect.ts                   # Shared detection helpers (detect_binding, get_skill_path)
├── features/
│   └── indexed.ts              # Indexed feature — skill, prompt hint, footer, freshness
├── commands/
│   └── init.ts                 # /qmd init command + qmd_init tool
├── core/
│   ├── errors.ts               # Agent-legible typed errors
│   ├── qmd-store.ts            # SDK wrapper with lazy lifecycle
│   └── types.ts                # Zod schemas + TypeBox tool params
├── domain/
│   ├── freshness.ts            # Git-based markdown freshness
│   ├── onboarding.ts           # Deterministic init pipeline
│   └── repo-binding.ts         # Repo root, collection key, marker I/O
├── skills/
│   └── qmd/
│       └── SKILL.md            # Extension-owned QMD skill reference
├── docs/
│   ├── architecture.md         # Layer diagram and responsibilities
│   ├── freshness.md            # Freshness model and footer behavior
│   └── onboarding.md           # Init flow steps and caveats
└── __tests__/
    ├── core/
    │   ├── qmd-store.test.ts
    │   ├── handelize.test.ts
    │   └── types.test.ts
    ├── domain/
    │   ├── freshness.test.ts
    │   ├── onboarding.test.ts
    │   └── repo-binding.test.ts
    └── features/
        └── indexed.test.ts
```

## Docs

- `docs/architecture.md` — layers, dependency direction, file responsibilities
- `docs/onboarding.md` — init flow steps and caveats
- `docs/freshness.md` — freshness model and footer behavior
