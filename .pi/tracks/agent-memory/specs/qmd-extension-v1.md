# QMD Extension — v1 Spec

> Status: draft
> Created: 2026-03-13
> Updated: 2026-03-13
> Track: agent-memory

## Overview

Pi extension that manages QMD as the **knowledge infrastructure layer** for coding agents.
It handles repository onboarding, auto-detection, freshness, status, and agent guidance.

**Key distinction:**
- The **extension** owns infra and workflow.
- The **agent** uses QMD through the CLI via `bash`, guided by `skills/qmd/SKILL.md`.
- The extension does **not** provide an always-on search tool.

This keeps normal work simple and composable:

```
User /qmd init|status|update
        ↓
Extension detects / validates / updates index state
        ↓
Agent uses bash → qmd query/search/get when it needs conceptual search
```

## Design Principles

This design follows two main lenses:

### Unix philosophy
- **Modularity** — small parts with clean interfaces
- **Separation** — policy separated from mechanism
- **Representation** — put durable knowledge into data, keep logic boring
- **Silence** — avoid ambient UI noise when nothing actionable is happening
- **Repair** — fail early with agent-legible errors

### Deep modules / AI-ready codebase
- Hide QMD/SQLite/config complexity behind a small internal API
- Keep a few **deep modules**, not many shallow helpers
- Make boundaries explicit and validated
- Use **Zod-first** contracts at runtime and file/LLM boundaries; keep any TypeBox usage minimal and only where Pi tool registration requires it
- Let the LLM refine user-facing proposals, but keep core mechanics deterministic

## What v1 Is Building

A repo-local QMD integration with four jobs:

1. **Know whether this repo is indexed**
2. **Know whether that index is stale**
3. **Help the user onboard or refresh the repo**
4. **Tell the agent when to use QMD CLI**

It is **not** building:
- an always-on QMD tool for the agent
- automatic search interception
- automatic memory extraction
- a TUI search browser

## Architecture

### Conceptual Modules

```mermaid
graph TB
    subgraph "Extension"
        runtime[runtime.ts\nPi hooks + footer + prompt wiring]
        command[command.ts\n/qmd init|status|update]
        tool[tool.ts\nqmd_init workflow tool]
    end

    subgraph "Domain"
        binding[repo-binding.ts\nrepo↔QMD binding + detection + marker]
        onboarding[onboarding.ts\nscan → draft → normalize → execute]
        freshness[freshness.ts\ngit-based staleness]
    end

    subgraph "Core"
        store[qmd-store.ts\nSDK lifecycle + QMD operations]
        types[types.ts\nschemas + shared types]
        errors[errors.ts\ntyped errors]
    end

    subgraph "External"
        qmdsdk[@tobilu/qmd SDK]
        qmddb[(~/.cache/qmd/index.sqlite)]
        marker[(.pi/qmd.json)]
        skill[skills/qmd/SKILL.md]
        agent[Agent via bash\nqmd query/search/get]
    end

    runtime --> binding
    runtime --> freshness
    runtime --> command
    command --> onboarding
    command --> binding
    command --> store
    command -.-> tool
    tool --> onboarding

    binding --> store
    binding --> marker
    freshness --> marker
    onboarding --> store
    onboarding --> marker

    store --> qmdsdk
    qmdsdk --> qmddb
    runtime -.-> skill
    runtime -.-> agent
```

### Dependency Direction

**Extension → Domain → Core → QMD SDK**

No upward imports.
No Pi-specific logic in Domain or Core.

## Responsibility Split

| Concern | Owner | How |
|---|---|---|
| Repo detection | Domain + Core | marker fast path, SDK fallback, match by repo root |
| Repo freshness | Domain | git diff against last indexed commit |
| Repo onboarding | Domain + Extension | deterministic draft + LLM refinement + tool execution |
| Manual status | Extension | `/qmd status` |
| Manual update | Extension + Core | `/qmd update` for current repo collection only |
| Agent search behavior | Agent skill | `bash` → `qmd query/search/get` |
| Teaching agent QMD exists | Extension | `before_agent_start` prompt injection |

## Canonical Data Model

### Canonical repo identity

The canonical identity is the repo root path:

- `repo_root = realpath(cwd-at-repo-root)`

There is exactly **one QMD binding per repository root**.
Collision handling is not a product concern in v1 because identity is path-based.

### QMD collection key

QMD collection names only allow `[a-zA-Z0-9_-]`, so the extension cannot store the raw path directly as the collection name.

v1 rule:
- **canonical identity** = normalized absolute repo path
- **QMD collection key** = deterministic encoding of that path

Recommended encoding:
- `collection_key = "p_" + base64url(repo_root)` (no padding)

This keeps the identity path-derived, deterministic, and collision-free without inventing a second naming policy.

### Local marker: `.pi/qmd.json`

This file is a **binding + freshness marker only**.
It is **not** a mirror of QMD config or contexts.

```ts
const QmdRepoMarker = z.object({
  schema_version: z.literal(1),
  repo_root: z.string(),
  collection_key: z.string(),
  last_indexed_at: z.string(),
  last_indexed_commit: z.string(),
  created_at: z.string(),
});
```

### Source-of-truth rules

- **QMD store** is the source of truth for:
  - collections
  - indexed paths / glob pattern
  - path contexts / annotations
- **`.pi/qmd.json`** is the source of truth for:
  - repo ↔ collection binding
  - last indexed commit/time for freshness

This avoids duplicated config drift.

## Core Module

### `core/qmd-store.ts`

Owns all SDK interaction.

Responsibilities:
- lazy singleton `get_store()`
- `close_store()` on `session_shutdown`
- wrap SDK errors into typed, agent-legible errors
- expose boring QMD operations used by Domain:
  - `list_collections()`
  - `get_collection_by_repo_root()`
  - `add_collection()`
  - `set_contexts()`
  - `update_collection()`
  - `embed_pending()`
  - `get_status()`

### `core/types.ts`

Owns:
- Zod schema for `.pi/qmd.json`
- Zod schemas for onboarding proposals and normalized domain payloads
- a minimal TypeBox adapter only for Pi tool registration, derived from the narrower tool boundary
- normalized domain types:
  - `RepoBinding`
  - `FreshnessResult`
  - `RepoScan`
  - `DraftInitProposal`
  - `NormalizedInitProposal`

### `core/errors.ts`

Typed errors, for example:
- `QmdUnavailableError`
- `RepoNotIndexedError`
- `CollectionBindingMismatchError`
- `InvalidInitProposalError`

## Domain Modules

## `domain/repo-binding.ts`

Owns repo/QMD binding and marker reconciliation.

API:

```ts
async function detect_repo_binding(cwd: string): Promise<RepoBindingResult>
async function read_repo_marker(cwd: string): Promise<QmdRepoMarker | null>
async function write_repo_marker(cwd: string, marker: QmdRepoMarker): Promise<void>
function collection_key_from_repo_root(repo_root: string): string
```

Detection order:
1. Find repo root / normalize cwd
2. Read `.pi/qmd.json` if present
3. Verify marker against SDK by repo root or collection key
4. Fallback: `store.listCollections()` and match `pwd === repo_root`
5. Return indexed / not indexed / unavailable

Important behavior:
- Matching is path-based, not basename-based
- If marker exists but no longer matches QMD, report a repairable mismatch
- Marker is small and local; SDK remains authoritative

## `domain/freshness.ts`

Owns stale/fresh detection.

```ts
async function check_freshness(marker: QmdRepoMarker): Promise<FreshnessResult>
```

Strategy:

```bash
git diff --name-only --diff-filter=ACMR <last_indexed_commit>..HEAD -- '*.md'
```

Returns:
- `fresh`
- `stale` with changed file list/count
- `unknown` for non-git repos or missing commit

v1: non-git fallback is deferred.

## `domain/onboarding.ts`

Owns init as a deterministic pipeline.

### Design

The LLM is **not** responsible for inventing the repo structure from scratch.
It only refines and explains a structured draft.

### Pipeline

#### Phase 1 — scan repo

```ts
async function scan_repo(root: string): Promise<RepoScan>
```

Collects facts only:
- repo root
- markdown file count
- key files (`README.md`, `ARCHITECTURE.md`, etc.)
- directory summaries with counts
- a capped sample of relevant directories/files
- project shape hints (`extensions/`, `skills/`, `docs/`, `src/`, `packages/`, etc.)

The scan should be bounded and prompt-safe. v1 should avoid dumping giant raw file trees into chat.

#### Phase 2 — build deterministic draft

```ts
function build_draft_proposal(scan: RepoScan): DraftInitProposal
```

Heuristics produce:
- `repo_root`
- `collection_key`
- default glob pattern (`**/*.md`)
- candidate path contexts

Example heuristics:
- `/docs` → `Project documentation`
- `/.pi` → `Agent runtime memory and repo-local agent context`
- `/extensions` → `Pi extension implementations`
- `/skills` → `Agent skills and operator guidance`
- `/src` → `Source code documentation and inline architecture notes`

#### Phase 3 — build init prompt

```ts
function build_init_prompt(scan: RepoScan, draft: DraftInitProposal): string
```

Prompt contains:
- concise repo summary
- deterministic draft proposal
- instructions to review/refine, not reinvent
- explicit confirmation rule before tool call

#### Phase 4 — normalize and validate confirmed proposal

```ts
function normalize_init_proposal(input: ConfirmedProposal): NormalizedInitProposal
```

Semantic validation rules:
- `root` must equal normalized repo root
- every path must stay inside repo root
- path prefixes normalized to repo-relative form
- duplicate / overlapping prefixes deduped deterministically
- annotations trimmed and non-empty
- contexts sorted shortest-prefix-first or by explicit precedence rule
- collection key must match `collection_key_from_repo_root(root)` in v1

#### Phase 5 — execute init

```ts
async function execute_init(proposal: NormalizedInitProposal): Promise<InitResult>
```

Execution:
1. add collection for repo root
2. write contexts
3. run update for that collection only
4. run embed only if embeddings are pending
5. write `.pi/qmd.json`
6. return indexed/fresh state

## Extension Module

## `extension/runtime.ts`

Owns Pi wiring.

### `session_start`
1. detect repo binding
2. if indexed, check freshness
3. render footer status
4. otherwise stay silent

### `before_agent_start`
If indexed, inject short guidance:

```text
This repository is indexed by QMD.
Use `qmd query -c {collection_key} "question"` via bash when you need
conceptual search, prior decisions, or design context.
Use rg/grep for exact strings.
Refer to skills/qmd/SKILL.md for the full reference.
```

### `session_shutdown`
Close the QMD store.

## `extension/command.ts`

User-facing commands:

```text
/qmd init
/qmd status
/qmd update
```

### `/qmd status`
Shows current repo state only:
- indexed / not indexed / unavailable
- collection key
- repo root
- fresh / stale / unknown
- stale count if known

### `/qmd update`
Updates **current repo collection only**.
Never reindexes all collections by default.

Flow:
1. resolve repo binding
2. run `update({ collections: [collection_key] })`
3. run embed only if `needsEmbedding > 0`
4. update marker timestamps/commit
5. refresh footer

### `/qmd init`
Flow:
1. detect repo root
2. scan repo
3. build deterministic draft
4. activate `qmd_init`
5. inject init context into chat
6. agent presents/refines proposal
7. tool executes only after user confirmation

## `extension/tool.ts`

### `qmd_init`

Registered at load, inactive by default.

Purpose:
- execute a **confirmed, normalized** onboarding proposal

Parameters should stay narrow:

```ts
// Runtime/source-of-truth schema
const qmd_init_params_schema = z.object({
  root: z.string(),
  paths: z.array(
    z.object({
      path: z.string(),
      annotation: z.string(),
    }),
  ),
  glob_pattern: z.string().optional(),
});

// Minimal Pi registration adapter at the boundary
const QmdInitParams = Type.Object({
  root: Type.String({ description: "Absolute repo root" }),
  paths: Type.Array(Type.Object({
    path: Type.String({ description: "Repo-relative path prefix, e.g. 'docs'" }),
    annotation: Type.String({ description: "Human-written context for that path" }),
  })),
  glob_pattern: Type.Optional(Type.String({ description: "Defaults to **/*.md" })),
});
```

Notes:
- `collection_key` should be derived internally from `root`, not supplied by the model
- Zod is the runtime authority; the TypeBox schema exists only because Pi tool registration requires it
- tool schema protects shape; Domain normalization protects semantics

## Workflow-Scoped Tool Activation

Dynamic tool activation is still the right v1 pattern, but it should be treated as **workflow state**, not an inline trick.

### Rules
- register `qmd_init` at load
- remove it from the active tool set immediately
- `/qmd init` activates it
- `execute_init()` deactivates it in `finally`
- extension never replaces the full active tool list; it only adds/removes `qmd_init`

### v1 caveat

`pi.setActiveTools()` is shared mutable session state.
Other modal extensions may also rewrite active tools.

v1 policy:
- QMD only appends/removes its own workflow tool
- it does not attempt to become a global tool-state coordinator
- if another extension fully replaces active tools during init, rerun `/qmd init`

This limitation should be documented rather than hidden.

## Footer Behavior

Follow the Rule of Silence.

Footer states:
- indexed + fresh → `qmd: indexed ✓`
- indexed + stale → `qmd: indexed · 3 stale`
- indexed + unknown freshness → `qmd: indexed · freshness unknown`
- not indexed → **silent**
- QMD unavailable → **silent**

Explicit `/qmd status` is how the user learns more when nothing is indexed.

## SDK Integration

Dependency:
- local fork at `~/git/qmd-fork`
- linked via `bun link`

Use the SDK for infrastructure operations only.
Do **not** route search through the extension.

## Directory Structure

```text
extensions/qmd/
├── README.md
├── index.ts
├── docs/
│   ├── architecture.md
│   ├── onboarding.md
│   └── freshness.md
├── core/
│   ├── qmd-store.ts
│   ├── types.ts
│   └── errors.ts
├── domain/
│   ├── repo-binding.ts
│   ├── freshness.ts
│   └── onboarding.ts
├── extension/
│   ├── runtime.ts
│   ├── command.ts
│   └── tool.ts
└── __tests__/
    ├── core/
    ├── domain/
    └── extension/
```

This is intentionally smaller and deeper than the earlier draft.

## v1 Scope

| Feature | Status | Notes |
|---|---|---|
| `/qmd init` | ✅ v1 | deterministic draft + LLM refinement + confirmed tool execution |
| `/qmd status` | ✅ v1 | current repo only |
| `/qmd update` | ✅ v1 | current repo collection only |
| path-based repo identity | ✅ v1 | canonical identity is normalized repo root |
| small `.pi/qmd.json` marker | ✅ v1 | binding + freshness only |
| auto-detect on session start | ✅ v1 | marker fast path + SDK fallback |
| freshness via git diff | ✅ v1 | fast and transparent |
| prompt injection | ✅ v1 | teach CLI usage only |
| workflow-scoped init tool | ✅ v1 | active only during init |
| silent non-indexed footer | ✅ v1 | no ambient noise |
| auto-update before first query | 🔜 v2 | requires interception strategy |
| first-message retrieval injection | 🔜 v2 | possible BM25/probe layer |
| TUI search UI | 🔜 future | user-facing, not core infra |

## Open Questions

1. **Path encoding format** — base64url is the current recommendation because it is deterministic and collision-free, but confirm length/ergonomics are acceptable for CLI usage.
2. **SDK collection-list latency** — benchmark whether `listCollections()` is fast enough that marker verification can stay simple.
3. **Embed latency during init** — should long initial embedding show progress updates in the tool renderer?
4. **Non-git repos** — defer mtime-based freshness fallback unless it becomes a common case.
