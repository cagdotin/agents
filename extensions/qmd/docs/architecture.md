# QMD Extension Architecture

## Layers

- **Extension**
  - `extension/runtime.ts` — session lifecycle hooks, footer, prompt injection
  - `extension/tool.ts` — workflow-scoped `qmd_init` tool
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
Extension → Domain → Core → QMD SDK
```

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

Note: `get_active_document_paths()` uses `store.internal.getActiveDocumentPaths()` — the low-level `InternalStore`, not the high-level `QMDStore`.

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

## Extension responsibilities

### `extension/runtime.ts`
- bootstrap binding/freshness once on activation, then refresh on `session_tree` and `session_compact`
- set quiet footer status (silent when not indexed)
- build the QMD CLI prompt hint from the current repo-binding state
- inject only the active `/qmd init` workflow prompt via `before_agent_start`
- close the store on `session_shutdown`

### `extension/tool.ts`
Workflow-scoped `qmd_init` tool.
It is registered at load time but removed from the active tool set by default.
`/qmd init` activates it and execution deactivates it in `finally`.

## Source-of-truth rule

Do not let `.pi/qmd.json` become a second config system.

- collections + contexts live in QMD
- `.pi/qmd.json` only tracks binding + freshness metadata
