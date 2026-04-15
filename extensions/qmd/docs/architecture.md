# QMD Extension Architecture

## Layers

- **Features** (conditional)
  - `features/indexed.ts` — activated when repo is indexed: skill exposure, prompt hint, footer, freshness refresh
- **Commands**
  - `commands/init.ts` — `/qmd init` command, `qmd_init` tool, workflow prompt injection
- **Domain**
  - `domain/repo-binding.ts` — repo root, collection key, marker I/O
  - `domain/freshness.ts` — git-based markdown freshness detection
  - `domain/onboarding.ts` — deterministic init pipeline
- **Core**
  - `core/qmd-store.ts` — SDK wrapper with lazy lifecycle
  - `core/types.ts` — Zod schemas and TypeBox tool params
  - `core/errors.ts` — agent-legible typed errors

Dependency direction stays one-way:

```
Commands / Features → Domain → Core → QMD SDK
```

## Feature model

The extension has one conditional feature and one command:

- **indexed** (`features/indexed.ts`) — uses `register_conditional_feature` with async detection. Enabled when `binding.status === "indexed"`. Exposes QMD skill, injects prompt hint, sets footer, refreshes freshness on session events.
- **init** (`commands/init.ts`) — always registered as a `/qmd init` command. Scans the repo, builds a draft proposal, sends it as a user message for agent refinement, and activates the `qmd_init` tool. If the repo is already indexed, the command says so and returns.

The store lifecycle (`session_shutdown → close_store`) is shared infrastructure registered in `index.ts`.

## Core responsibilities

### `core/types.ts`
Runtime schemas and normalized types.
Zod is the runtime authority.
TypeBox is only used at the Pi tool-registration boundary (`QmdInitParams`).

### `core/errors.ts`
Agent-legible typed errors:
- `QmdUnavailableError` — store can't be opened
- `CollectionBindingMismatchError` — marker/store drift
- `InvalidInitProposalError` — bad onboarding input

### `core/qmd-store.ts`
Small wrapper around `@tobilu/qmd`:
- lazy store lifecycle (module-level singleton via `store_promise`)
- translated errors via `with_store()`
- narrow helpers: `list_collections`, `add_collection`, `set_contexts`, `list_contexts`, `update_collection`, `embed_pending`, `get_status`, `get_active_document_paths`, `get_index_health`, `close_store`

## Domain responsibilities

### `domain/repo-binding.ts`
- find normalized repo root
- derive path-based collection key
- read/write `.pi/qmd.json`
- reconcile marker and QMD store (legacy key fallback + repair warnings)

### `domain/freshness.ts`
- compare `last_indexed_commit` against `HEAD` with markdown-only diff
- return `fresh | stale | unknown`

### `domain/onboarding.ts`
Deterministic pipeline:
- scan repo (bounded traversal)
- build draft proposal
- build init prompt for agent refinement
- normalize confirmed proposal via Zod
- execute init via the store wrapper

## Source-of-truth rule

Do not let `.pi/qmd.json` become a second config system.

- collections + contexts live in QMD
- `.pi/qmd.json` only tracks binding + freshness metadata
