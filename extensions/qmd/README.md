# QMD Extension

Repo-local QMD infrastructure for Pi.

## What it does

- Detects whether the current repo is indexed by QMD
- Activates the QMD runtime through extension-local repo-binding detection
- Tracks repo freshness via `.pi/qmd.json`
- Adds a quiet footer for indexed repos only
- Exposes the QMD skill only for indexed repos via `resources_discover`
- Adds a cached system prompt hint so the agent knows when to use `qmd query/search/get` via `bash`
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
│   ├── runtime.ts              # Session hooks, footer, prompt hint builder, init-workflow prompt
│   └── tool.ts                 # Workflow-scoped qmd_init tool
├── skills/
│   └── qmd/
│       └── SKILL.md            # Extension-owned QMD skill reference
├── diy/
│   ├── README.md               # How to copy/paste this blueprint into another repo
│   ├── qmd-extension-snapshot-spec.md
│   ├── qmd-extension-diy-execution-plan.md
│   ├── agent-prompt-template.md
│   └── references.md
├── docs/
│   ├── architecture.md         # Layer diagram and responsibilities
│   ├── freshness.md            # Freshness model and footer behavior
│   └── onboarding.md           # Init flow steps and caveats
└── __tests__/
    ├── core/
    │   ├── qmd-store.test.ts
    │   └── types.test.ts
    ├── domain/
    │   ├── freshness.test.ts
    │   ├── onboarding.test.ts
    │   └── repo-binding.test.ts
    └── extension/
        └── runtime.test.ts
```

## DIY blueprint

If you want to recreate this extension in another repo without installing this package, use:

- `diy/README.md` — copy/paste usage instructions
- `diy/qmd-extension-snapshot-spec.md` — current behavior blueprint
- `diy/qmd-extension-diy-execution-plan.md` — implementation milestones
- `diy/references.md` — internal docs + agent-memory raw links
- `diy/agent-prompt-template.md` — copy/paste prompt for rebuilding elsewhere

## Lifecycle model

- `session_start` — repo-binding activation + runtime bootstrap for startup/reload/new/resume/fork
- `resources_discover` — expose the extension-owned QMD skill only for indexed repos
- `before_agent_start` — indexed-repo prompt hint from repo-binding state, plus active `/qmd init` workflow prompt from runtime state
- `session_tree` / `session_compact` — refresh binding and freshness state within the current session
- `session_shutdown` — close the QMD store

## Docs

- `docs/architecture.md` — layers, dependency direction, file responsibilities
- `docs/onboarding.md` — init flow steps and caveats
- `docs/freshness.md` — freshness model and footer behavior
