# Decisions

## QMD as the primary knowledge engine
- **Rationale:** QMD matches our stack (TypeScript/Bun), runs locally, requires no server, and gives us strong markdown retrieval without adding infrastructure.
- **Tradeoff:** We do not get OpenViking's automatic tiering or memory extraction out of the box. Those ideas remain future inputs for expertise/tracks rather than reasons to reject QMD.

## One global QMD index, one collection binding per repository
- **Rationale:** A single global index keeps cross-project search possible, while each repository still has one clear binding for focused work.
- **Rule:** The canonical identity is the normalized repo root path. There is one binding per repo root.

## Path-derived identity, not basename naming
- **Rationale:** Basename-based names create unnecessary collision policy and weaken detection semantics. The repo path already gives us a unique identity.
- **Implementation rule:** Treat the normalized repo root as canonical identity. Derive the QMD collection key deterministically from that path.
- **Constraint:** QMD collection names cannot contain arbitrary path characters, so the extension stores a path-derived encoded key rather than the raw path as the collection name.

## QMD store is the source of truth; `.pi/qmd.json` is only a marker
- **Rationale:** Duplicating collection config and contexts in a repo-local file creates drift and weakens the boundary.
- **Rule:**
  - QMD store owns collections, patterns, and contexts
  - `.pi/qmd.json` owns only repo binding + freshness metadata
- **Effect:** The marker stays small, local, and repairable instead of becoming a second config system.

## SDK over CLI for extension internals
- **Rationale:** The extension should use typed SDK operations for detection, indexing, status, and context management.
- **Tradeoff:** We remain dependent on the local fork until upstream Bun fixes land.
- **Boundary:** The extension uses the SDK for infrastructure only. Search remains CLI-driven by the agent.

## Agent uses QMD through CLI, not an always-on extension tool
- **Rationale:** Search is already well-expressed by `bash` + `qmd query/search/get`, and the skill gives the agent the right usage pattern.
- **Benefit:** This keeps the extension small and Unix-like: infra in the extension, retrieval in the CLI, composition through existing tools.

## Lazy store singleton
- **Rationale:** Opening the QMD store is cheap, and QMD already manages model lifecycle lazily.
- **Lifecycle:** Open on first use, close on `session_shutdown`.

## Zod-first validation
- **Rationale:** Runtime/file/LLM boundaries need a single trustworthy validation system.
- **Rule:** Use Zod as the runtime authority for marker files, scan output, confirmed proposals, and normalization.
- **Exception:** Use TypeBox only where Pi `registerTool().parameters` requires it.

## Deterministic onboarding draft, LLM refinement second
- **Rationale:** The init workflow should not depend on the model inventing repo structure from a raw dump. That is brittle and harder to validate.
- **Pipeline:** scan repo → deterministic draft proposal → LLM refines with user → normalize/validate → execute.
- **Benefit:** More predictable behavior, smaller prompts, clearer boundaries.

## Git-based freshness detection
- **Rationale:** `git diff --name-only` is fast, transparent, and good enough for markdown freshness in v1.
- **Tradeoff:** Non-git repos return `unknown` freshness until we decide an mtime fallback is worth the complexity.

## Manual updates in v1
- **Rationale:** Auto-update before first query would require interception and hidden coordination. That adds complexity too early.
- **Rule:** v1 surfaces freshness and lets the user run `/qmd update` explicitly.

## `/qmd update` is repo-scoped only
- **Rationale:** Updating all collections from inside one repo would be surprising and violate least surprise.
- **Rule:** `/qmd update` resolves the current repo binding and updates that collection only.

## Workflow-scoped init tool remains the right v1 compromise
- **Rationale:** The agent does not need an init tool in steady state, but it does need a structured execution boundary during onboarding.
- **Mechanism:** Register `qmd_init`, keep it inactive, activate it during `/qmd init`, deactivate it in `finally` after execution.
- **Caveat:** `setActiveTools()` is shared mutable state, so v1 should document this limitation instead of pretending to coordinate all tool modes globally.

## Prefer deeper modules over many shallow helpers
- **Rationale:** The earlier Core/Features/Extension split risked becoming too file-fragmented for v1.
- **Decision:** Reshape around a smaller set of deeper modules:
  - `core/qmd-store.ts`
  - `core/types.ts`
  - `core/errors.ts`
  - `domain/repo-binding.ts`
  - `domain/freshness.ts`
  - `domain/onboarding.ts`
  - `extension/runtime.ts`
  - `extension/command.ts`
  - `extension/tool.ts`

## Footer follows the rule of silence
- **Rationale:** A permanent `not indexed` footer is ambient noise, not actionable status.
- **Rule:** Show footer only for indexed repos (fresh/stale/unknown freshness). Stay silent otherwise.

## Track-scoped specs and plans
- **Rationale:** Keep work-in-progress planning artifacts inside the track while the design is still evolving. Promote durable outcomes into repo docs when the design stabilizes.
