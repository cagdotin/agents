# Findings

## QMD Architecture

- **Local-first, zero infrastructure.** Single SQLite file, local models, no API keys, no server process.
- **Stack match.** TypeScript/Bun — exactly our stack. SDK is straightforward to consume from Bun once linked correctly.
- **Hybrid search pipeline is sophisticated.** Query expansion → BM25 + vector → fusion → reranking. This makes QMD strong enough to be the deep retrieval layer without us building search ourselves.
- **Smart markdown chunking is built in.** Heading-aware chunking and code-fence handling mean we do not need custom markdown segmentation for v1.
- **Context annotations are the highest-leverage feature for agents.** Path-level context gives search results enough domain labeling to be useful in agent workflows.
- **SDK is good for infrastructure operations.** Collection management, context writes, update/embed, and status are better handled via SDK than shelling out and parsing JSON/text.
- **Search should still stay CLI-driven for the agent.** The extension does not need to wrap `search()` just because the SDK offers it. `bash` + `qmd query/search/get` is the cleaner integration point for normal agent work.

## QMD Constraints That Shape the Extension Design

- **Collection names are restricted.** QMD collection names accept only alphanumeric characters, hyphens, and underscores. Raw repo paths cannot be used directly as collection names.
- **Repo identity and collection key should be treated separately.** The canonical identity can still be the normalized repo root path, while the stored collection key is a deterministic encoding derived from that path.
- **`createStore()` at the SDK boundary needs explicit options.** The extension should not assume a zero-arg happy path; it must own store creation/config robustly.
- **`update()` must be scoped intentionally.** Unscoped SDK update behavior risks touching unrelated collections, so `/qmd update` must always resolve and pass the current repo collection explicitly.

## Local Fork & Bun Compatibility

- **Root cause of sqlite-vec failure under Bun:** Apple's system SQLite disables extension loading. Bun must be pointed at Homebrew SQLite via `Database.setCustomSQLite(...)`.
- **PR #377 is the real Bun fix.** It sets the SQLite dylib path and validates sqlite-vec loading early.
- **PR #385 fixes secondary install/runtime issues.** It corrects launcher lockfile priority and a cleanup crash around orphaned vectors.
- **`bun link` is required for SDK access in Bun projects.** `npm link` alone is not enough if the consuming project imports the package in Bun.

## Multi-Project Landscape (why this matters)

- **The real problem is pattern recall across repos.** We already have many markdown-heavy projects and agent-facing docs; the pain is not storing more notes, it is finding the right prior art quickly.
- **One global index with per-repo bindings is the right compromise.** It preserves cross-project retrieval while still keeping repo-local workflows focused.

## Design Learnings for the QMD Extension

- **The extension should be infrastructure, not a search facade.** Search remains a composition of `bash` + QMD CLI + the skill. The extension handles onboarding, status, freshness, and guidance.
- **`.pi/qmd.json` must stay small.** If it starts mirroring QMD collection config or contexts, we create a second config system and drift becomes likely.
- **Deterministic draft before LLM refinement is the right init shape.** Let the extension scan and build a structured draft first; let the model refine with the user rather than inventing the structure from a raw file dump.
- **Zod should be the runtime authority.** File formats, repo-scan payloads, and confirmed init proposals all need one trustworthy validation system. TypeBox should remain only a Pi registration adapter.
- **Workflow-scoped tool activation is viable but not magical.** `setActiveTools()` is shared mutable session state, so the design should document that caveat instead of pretending global tool coordination is solved.
- **Silent non-indexed state is better UX.** A persistent `not indexed` footer is noise. Status should be visible when useful and quiet otherwise.

## OpenViking Architecture (transferable ideas only)

- **The most transferable idea is tiering, not the stack.** L0/L1/L2 and hierarchical retrieval are useful design inspirations, but OpenViking's implementation is too heavyweight for direct adoption here.
- **Virtual filesystem and deterministic navigation remain valuable inspiration.** They reinforce our preference for file-based working memory and explicit navigation over opaque orchestration.

## Comparison to Our Current System

| Dimension | Our System (pi) | QMD | OpenViking |
|-----------|----------------|-----|------------|
| Knowledge storage | `.pi/expertise/` YAML + `.pi/tracks/` files | SQLite + markdown collections | Virtual filesystem + vector index |
| Search | Manual (grep, file reads, QMD skill) | BM25 + vector + reranking | Hierarchical vector + intent analysis |
| Memory evolution | Manual promotion | None by itself | Automatic extraction + dedup |
| Session context | File-based working memory | None | Built-in session compression/extraction |
| Stack | TypeScript/Bun | TypeScript/Bun ✅ | Python/Go/Rust ❌ |
| Infrastructure | Zero | Zero | Server + API keys + config |
| Fit for this repo | Good with manual discipline | Strong for retrieval ✅ | Strong ideas, weak fit ❌ |
