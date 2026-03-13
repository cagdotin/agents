# QMD Extension v1 — Execution Plan

> Status: active
> Spec: `../specs/qmd-extension-v1.md`
> Created: 2026-03-13
> Updated: 2026-03-13
> Track: agent-memory

## Implementation Rules

- **Zod-first** for file formats, runtime payloads, repo-scan output, LLM-confirmed proposals, and normalization.
- Use **TypeBox only at the Pi tool-registration boundary** where `registerTool().parameters` requires it.
- **QMD store is the source of truth** for collections and contexts.
- **`.pi/qmd.json` is only a repo-binding + freshness marker.**
- **Canonical repo identity is the normalized repo root path.**
- `/qmd update` must update **current repo collection only**, never all collections by default.
- Footer follows the **rule of silence**: show indexed states only; stay silent when not indexed.

## Milestones

### Milestone 1: Core + Contracts
**Goal**: Establish deep module boundaries and trusted schemas.

- [ ] Scaffold extension structure:
  - [ ] `core/`
  - [ ] `domain/`
  - [ ] `extension/`
  - [ ] `docs/`
  - [ ] `__tests__/`
- [ ] `core/errors.ts`
  - [ ] Define typed, agent-legible errors
  - [ ] Cover QMD unavailable / binding mismatch / invalid proposal cases
- [ ] `core/types.ts`
  - [ ] Zod schema for `.pi/qmd.json`
  - [ ] Zod schemas for scan result, draft proposal, confirmed proposal, normalized proposal
  - [ ] Minimal TypeBox `QmdInitParams` derived for Pi tool registration only
- [ ] `core/qmd-store.ts`
  - [ ] Lazy singleton for `createStore()`
  - [ ] Wrap SDK operations behind narrow helpers
  - [ ] Error translation layer
- [ ] `index.ts`
  - [ ] Minimal extension entry
  - [ ] Register command/tool/runtime wiring
- [ ] Verify SDK import works from extension
- [ ] Confirm `collection_key_from_repo_root()` encoding approach
- [ ] Tests:
  - [ ] marker schema validation
  - [ ] proposal schema validation
  - [ ] store open/close + error translation

**Validation**: extension loads; contracts parse trusted inputs; `bun run check` passes.

### Milestone 2: Repo Binding + Detection
**Goal**: Detect whether the current repo is indexed using a single clear source-of-truth model.

- [ ] `domain/repo-binding.ts`
  - [ ] normalize repo root
  - [ ] `collection_key_from_repo_root(repo_root)`
  - [ ] read/write `.pi/qmd.json`
  - [ ] marker verification against SDK
  - [ ] SDK fallback detection by `pwd === repo_root`
  - [ ] mismatch handling / repairable error messages
- [ ] Benchmark `store.listCollections()` latency
- [ ] Tests:
  - [ ] marker present + valid
  - [ ] marker present + stale/mismatched
  - [ ] no marker + SDK match by repo root
  - [ ] repo not indexed

**Validation**: indexed repo resolves to one binding; non-indexed repo returns a clean `not_indexed` result; no basename collision logic remains.

### Milestone 3: Runtime Wiring + Silent Footer
**Goal**: Surface indexed state without adding ambient noise.

- [ ] `extension/runtime.ts`
  - [ ] `session_start` → detect binding, check freshness, set footer
  - [ ] `before_agent_start` → inject concise QMD guidance when indexed
  - [ ] `session_shutdown` → close QMD store
- [ ] Footer behavior:
  - [ ] indexed + fresh
  - [ ] indexed + stale
  - [ ] indexed + unknown freshness
  - [ ] silent when not indexed
  - [ ] silent when QMD unavailable
- [ ] Tests:
  - [ ] prompt injection content
  - [ ] footer states
  - [ ] no-footer behavior for non-indexed repos

**Validation**: indexed repo shows useful status; non-indexed repo stays quiet; agent gets short CLI guidance only when needed.

### Milestone 4: Status + Scoped Update Command
**Goal**: User can inspect and refresh the current repo without touching unrelated collections.

- [ ] `extension/command.ts`
  - [ ] `/qmd status`
  - [ ] `/qmd update`
- [ ] `/qmd status`
  - [ ] resolve current repo binding
  - [ ] report indexed / not indexed / unavailable
  - [ ] report freshness state
  - [ ] show repo root + collection key
- [ ] `/qmd update`
  - [ ] resolve current repo binding
  - [ ] call `update({ collections: [collection_key] })`
  - [ ] run embed only when pending embeddings exist
  - [ ] update marker commit + timestamp on success
  - [ ] refresh footer state
- [ ] Tests:
  - [ ] command routing
  - [ ] current-repo-only update behavior
  - [ ] marker refresh after successful update
  - [ ] helpful output when repo is not indexed

**Validation**: `/qmd update` only updates the bound collection for the current repo.

### Milestone 5: Freshness Detection
**Goal**: Detect stale markdown content cheaply and transparently.

- [ ] `domain/freshness.ts`
  - [ ] git-based diff against `last_indexed_commit`
  - [ ] return `fresh | stale | unknown`
  - [ ] capture changed markdown paths/count
- [ ] Wire freshness into runtime + status output
- [ ] Tests:
  - [ ] clean repo
  - [ ] changed markdown file
  - [ ] new markdown file
  - [ ] non-git repo → `unknown`

**Validation**: change a markdown file, restart session, footer/status show stale count.

### Milestone 6: Deterministic Onboarding Pipeline
**Goal**: `/qmd init` produces a deterministic draft, then lets the LLM refine it with the user.

- [ ] `domain/onboarding.ts`
  - [ ] `scan_repo(root)`
  - [ ] `build_draft_proposal(scan)`
  - [ ] `build_init_prompt(scan, draft)`
  - [ ] `normalize_init_proposal(input)`
  - [ ] `execute_init(normalized)`
- [ ] Scan design:
  - [ ] bounded repo summary, not giant raw tree dumps
  - [ ] key files + directory summaries + markdown counts
- [ ] Draft design:
  - [ ] derive collection key from repo root
  - [ ] deterministic annotation heuristics for common folders
- [ ] Normalization/validation:
  - [ ] Zod parse confirmed proposal
  - [ ] root must equal normalized repo root
  - [ ] paths must stay inside repo root
  - [ ] dedupe overlapping prefixes
  - [ ] trim / require non-empty annotations
  - [ ] normalize repo-relative path prefixes
- [ ] Tests:
  - [ ] scan on representative mock repos
  - [ ] draft proposal heuristics
  - [ ] invalid path rejection
  - [ ] overlap dedupe / normalization

**Validation**: pipeline produces a stable draft before the LLM ever proposes changes.

### Milestone 7: Workflow Tool + Init UX Hardening
**Goal**: Activate the init tool only during onboarding and clean it up reliably.

- [ ] `extension/tool.ts`
  - [ ] register `qmd_init`
  - [ ] keep inactive by default
  - [ ] parse tool input through Zod after Pi boundary validation
- [ ] `/qmd init` command flow
  - [ ] scan repo
  - [ ] build deterministic draft
  - [ ] activate `qmd_init`
  - [ ] inject init context into chat
- [ ] Tool execution flow
  - [ ] normalize confirmed proposal
  - [ ] execute init
  - [ ] update marker
  - [ ] refresh footer
  - [ ] deactivate tool in `finally`
- [ ] Document v1 caveat about shared `setActiveTools()` state
- [ ] Tests:
  - [ ] active/inactive tool lifecycle
  - [ ] tool deactivation on success
  - [ ] tool deactivation on failure
  - [ ] post-TypeBox Zod parse at runtime

**Validation**: `/qmd init` exposes the tool only during the workflow and removes it even if execution fails.

### Milestone 8: Documentation + Quality Pass
**Goal**: Ship a documented, legible v1 with clear constraints.

- [ ] `README.md`
  - [ ] architecture overview
  - [ ] operator-facing command behavior
  - [ ] source-of-truth rules
- [ ] `docs/architecture.md`
  - [ ] deep module boundaries
  - [ ] repo-binding model
  - [ ] Zod-first validation story
- [ ] `docs/onboarding.md`
  - [ ] scan → draft → refine → normalize → execute flow
- [ ] `docs/freshness.md`
  - [ ] git-based stale detection
- [ ] Update track report/findings/decisions if implementation teaches us something non-obvious
- [ ] Quality pass:
  - [ ] agent-legible errors
  - [ ] no duplicated config truth
  - [ ] no global update behavior
  - [ ] no noisy footer behavior

**Validation**: docs and code tell the same story; v1 limitations are explicit.

## Deferred (v2+)

- Auto-update before first search
- First-message retrieval injection / BM25 probe
- Non-git freshness fallback
- TUI search UI
- Automatic promotion of durable findings into expertise

## Notes

- The most important architectural guardrail is: **do not let `.pi/qmd.json` become a second config system.**
- The most important UX guardrail is: **do not make `/qmd update` global.**
- The most important implementation guardrail is: **Zod owns runtime truth; Pi boundary schemas are adapters, not the design center.**
