# Decisions

## QMD is the tool to integrate; OpenViking is the design reference
- **Rationale:** Stack alignment (TypeScript/Bun), zero cost, zero infrastructure make QMD the pragmatic choice for searchable agent knowledge. OpenViking's Python/Go/Rust stack and server/API-key requirements make it impractical to adopt directly.
- **Tradeoff:** We lose OpenViking's L0/L1/L2 tiering and auto memory extraction — but we can build lightweight versions of those patterns into our own expertise/tracks system.

## One global index, collections per project
- **Rationale:** Single index means cross-project search is trivial (drop the `-c` filter). Collections provide per-project focus. Context annotations make results self-describing so agents know what they found.
- **Rejected alternative:** Per-project indexes (`--index name`). Cleaner separation but makes cross-project queries require multiple index lookups. Not worth the complexity.

## Projects added manually by user
- **Rationale:** User controls which projects are in the index. Not all 25+ repos are active or worth indexing. Start with `agents`, expand as needed.

## Three-layer integration plan
- **Layer 1 (now):** Global QMD install + CLI skill. Zero code. Validates search quality.
- **Layer 2 (next):** Pi extension wrapping QMD. Auto-detects project, provides `/qmd` command, hooks session lifecycle.
- **Layer 3 (future):** Expertise domains become thin navigational pointers (L0/L1). QMD becomes the deep retrieval layer (L2). Maps to OpenViking's tiering without the infrastructure.
- **Rationale:** Each layer validates the previous one before investing more. Layer 1 proves search quality. Layer 2 proves workflow integration. Layer 3 restructures how we think about agent memory.

## Non-memory projects excluded from this track
- The Agency (agent personas), Promptfoo (prompt testing), Impeccable (frontend design), Heretic (guardrail removal), NanoChat (LLM training) — evaluated in same research session but not memory-relevant. Track separately if needed.
