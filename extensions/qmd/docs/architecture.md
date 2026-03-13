# QMD Extension Architecture

## Layers

- **Extension**
  - `extension/runtime.ts`
  - `extension/command.ts`
  - `extension/tool.ts`
- **Domain**
  - `domain/repo-binding.ts`
  - `domain/freshness.ts`
  - `domain/onboarding.ts`
- **Core**
  - `core/qmd-store.ts`
  - `core/types.ts`
  - `core/errors.ts`

Dependency direction stays one-way:

`Extension -> Domain -> Core -> QMD SDK`

## Core responsibilities

### `core/types.ts`
Runtime schemas and normalized types.
Zod is the runtime authority.
TypeBox is only used at the Pi tool-registration boundary.

### `core/errors.ts`
Agent-legible typed errors for QMD availability, binding mismatches, and invalid onboarding proposals.

### `core/qmd-store.ts`
Small wrapper around `@tobilu/qmd`:
- lazy store lifecycle
- translated errors
- narrow collection/context/update helpers

## Domain responsibilities

### `domain/repo-binding.ts`
- find normalized repo root
- derive path-based collection key
- read/write `.pi/qmd.json`
- reconcile marker and QMD store

### `domain/freshness.ts`
- compare `last_indexed_commit` against `HEAD`
- return `fresh | stale | unknown`

### `domain/onboarding.ts`
Deterministic pipeline:
- scan repo
- build draft
- build init prompt
- normalize confirmed proposal
- execute init via the store wrapper

## Extension responsibilities

### `extension/runtime.ts`
- refresh binding/freshness on session lifecycle events
- set quiet footer status
- inject short QMD CLI guidance before the agent starts
- close the store on shutdown

### `extension/command.ts`
User-facing slash command:
- `/qmd status`
- `/qmd update`
- `/qmd init`

### `extension/tool.ts`
Workflow-scoped `qmd_init` tool.
It is registered at load time but removed from the active tool set by default.
`/qmd init` activates it and execution deactivates it in `finally`.

## Source-of-truth rule

Do not let `.pi/qmd.json` become a second config system.

- collections + contexts live in QMD
- `.pi/qmd.json` only tracks binding + freshness metadata
