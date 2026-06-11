# QMD Extension — Rebuild Spec

Retired: 2026-05-18

## Purpose

Repo-local QMD infrastructure for Pi. The extension integrated a local markdown search/index system with Pi so agents could discover and use QMD when a repository had been onboarded, without exposing an always-on search tool. It handled repo binding, onboarding workflow, prompt hints, and freshness/status reporting while leaving actual retrieval to the `qmd` CLI.

---

## User-facing surface

### Command: `/qmd init`

Always registered.

Purpose:
- onboard the current repository into QMD
- scan the repo deterministically
- draft a collection proposal
- send that proposal into chat for agent refinement and user confirmation
- only then allow execution via a temporary init tool

Usage:
- `/qmd init`

If the repo was already indexed, the command reported that state and exited.

### Tool: `qmd_init`

A temporary workflow tool used only during `/qmd init`.

Behavior:
- normally deactivated by default
- activated by the `/qmd init` workflow
- executed the confirmed onboarding proposal
- removed itself afterward

The extension intentionally did **not** expose a general-purpose search tool. Agents were expected to call the external `qmd` CLI directly (`qmd query`, `qmd search`, `qmd get`, etc.).

### Conditional skill exposure

When the current repo was recognized as indexed, the extension exposed an extension-owned QMD skill via `resources_discover` so the model would know:
- when to use QMD instead of `rg`
- example CLI invocations
- practical query patterns

### Prompt / footer surface

When indexed:
- injected a quiet system hint telling the model how and when to use QMD CLI commands
- set additive footer status text showing index freshness

Footer states:
- `qmd: indexed ✓`
- `qmd: indexed · N stale`
- `qmd: indexed · freshness unknown`

---

## Data model

### Marker file

Repo-local runtime marker:
- `.pi/qmd.json`

This was intentionally **not** a full config system. It stored binding and freshness metadata only.

Fields included:
- collection key
n- repo root / binding identity
- last indexed commit
- last indexed timestamp
- indexed status metadata

### Source of truth split

- QMD store: collections and path contexts
- `.pi/qmd.json`: local binding + freshness marker only

### Path contexts

During onboarding, the extension proposed path contexts derived from folder heuristics so the repo could be searched with semantic routing by area.

---

## Lifecycle

### Indexed feature activation

Conditional feature activated only when repo binding detection reported indexed state.

When active it:
- exposed the QMD skill
- injected prompt hints
- refreshed freshness on session events
- updated footer status

### Session events

The indexed feature refreshed binding/freshness on relevant session lifecycle events so footer state stayed current.

### Session shutdown

The extension closed the shared QMD store on `session_shutdown`.

### Registration model

- `index.ts` registered shared lifecycle and the init command
- `features/indexed.ts` handled conditional indexed-only behavior
- `commands/init.ts` handled onboarding workflow

---

## Key behaviors

### Deterministic onboarding

`/qmd init` did not ask the model to invent repo structure from scratch.
It deterministically:
- scanned the repo with bounded traversal
- counted markdown files
- sampled key files and top-level folders
- proposed a collection key derived from repo path
- proposed `**/*.md` indexing and path contexts
- asked the agent to refine rather than reinvent
- required user confirmation before execution

### Runtime validation

- Zod was the runtime authority for normalized onboarding proposals and marker data
- TypeBox was used only at the Pi tool boundary for init tool params

### Freshness model

Freshness was derived from git, not mtimes.

Conceptually:
- compare `last_indexed_commit` with `HEAD`
- consider only markdown changes
- classify as `fresh`, `stale`, or `unknown`

### Graceful unavailability

The extension lazy-loaded `@tobilu/qmd` at runtime.
If unavailable:
- extension still loaded
- indexed workflows stayed quiet where appropriate
- QMD-backed actions surfaced agent-legible errors explaining how to install/link the dependency

### Store wrapper

A narrow wrapper around the QMD SDK handled:
- lazy singleton lifecycle
- translated errors
- collection listing/creation
- context reads/writes
- update/embed/status helpers
- shutdown cleanup

### Binding repair behavior

Repo binding logic reconciled `.pi/qmd.json` against the QMD store, including legacy key fallback and repair warnings when marker/store drift was detected.

---

## Dependencies

### Pi APIs used
- `registerCommand()` for `/qmd init`
- conditional feature registration / `resources_discover`
- session lifecycle hooks for freshness refresh and shutdown cleanup
- footer/status APIs
- active-tool/session messaging APIs for init workflow handoff

### External libraries
- `@tobilu/qmd` — underlying QMD SDK, lazy-loaded at runtime
- Zod — runtime parsing/normalization
- TypeBox / `StringEnum` — tool parameter schema at registration boundary

### Repo helpers / patterns
- `lib/extension-runtime/conditional-feature.ts`
- extension-owned skill exposure through `resources_discover`

---

## Design decisions

- **Infra, not retrieval wrapper** — the extension managed onboarding and discoverability, but did not proxy every search through a Pi tool.
- **CLI remains the retrieval surface** — simpler and more transparent for agents already able to run shell commands.
- **Conditional exposure** — only show QMD guidance when the repo is actually indexed.
- **Lazy dependency loading** — kept the package loadable even if `@tobilu/qmd` was not installed.
- **Marker file is not config** — prevented `.pi/qmd.json` from becoming a second source of truth.
- **Git-based freshness** — better signal than file mtimes for markdown knowledge indexes.
- **Deterministic onboarding first, model refinement second** — reduced hallucinated repo structure during setup.

---

## Tests at time of removal

Coverage existed in:
- `extensions/qmd/__tests__/core/qmd-store.test.ts`
- `extensions/qmd/__tests__/core/handelize.test.ts`
- `extensions/qmd/__tests__/core/types.test.ts`
- `extensions/qmd/__tests__/domain/freshness.test.ts`
- `extensions/qmd/__tests__/domain/onboarding.test.ts`
- `extensions/qmd/__tests__/domain/repo-binding.test.ts`
- `extensions/qmd/__tests__/features/indexed.test.ts`

Coverage focused on store lifecycle/errors, path normalization, runtime schemas, freshness classification, onboarding normalization, repo-binding marker roundtrips, and indexed footer/prompt behavior.
