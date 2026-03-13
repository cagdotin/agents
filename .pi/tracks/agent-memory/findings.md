# Findings

## QMD Architecture

- **Local-first, zero infrastructure.** Single SQLite file, 3 GGUF models (~2GB total) auto-downloaded. No API keys, no server process needed.
- **Stack match.** TypeScript/Bun — exactly our stack. SDK: `import { createStore } from '@tobilu/qmd'`.
- **Hybrid search pipeline is sophisticated.** Query expansion (fine-tuned 1.7B model) → parallel BM25 + vector → RRF fusion (k=60, original query 2× weight, top-rank bonus) → LLM reranking (qwen3-reranker-0.6B) → position-aware blending (rank 1-3: 75% RRF / 25% reranker; rank 11+: 40%/60%).
- **Smart markdown chunking.** 900 tokens, 15% overlap, heading-aware break points (H1=100, H2=90, code fence=80), code blocks never split. Squared distance decay when choosing break points.
- **Context annotations are the killer feature for agents.** Label collections/paths with descriptions that travel with search results — gives LLM domain context about what kind of document it found.
- **MCP server supports both stdio and HTTP.** HTTP mode keeps models loaded in VRAM across requests. Also has a Claude Code plugin.
- **v2.0 (2026-03-10):** Stable SDK API. Unified `search()` with auto-expansion or pre-expanded typed queries. `intent` parameter disambiguates across the full pipeline.
- **Collections + collection filtering = the focus mechanism.** One collection per project dir. `-c project` scopes queries. Drop the filter for cross-project. Context annotations make results self-describing.
- **SDK is clean.** `createStore({ dbPath, config: { collections: {...} } })` → `store.search()` → `store.close()`. TypeBox types exported. Supports inline config, YAML config, or DB-only reopen.

## OpenViking Architecture

- **Virtual filesystem paradigm.** `viking://` URIs organize all context into Resources, Memories, and Skills directories. Agents use `ls`, `tree`, `find`, `read`, `grep` — deterministic operations, not fuzzy queries.
- **L0/L1/L2 tiered content — the most transferable idea.**
  - L0 (~100 tokens): one-sentence abstract → used for vector search
  - L1 (~2k tokens): structured overview with navigation pointers → used for planning
  - L2 (unlimited): full content → loaded only when needed
  - Generated bottom-up by LLM after resource ingestion
  - For code: tree-sitter AST skeletons (Python/JS/TS/Rust/Go/Java/C) instead of LLM — much cheaper
- **Hierarchical retrieval.** Intent analysis → global vector search → priority-queue recursive drill-down through subdirectories. Score propagation: `0.5 × embedding + 0.5 × parent_score`. Converges when top-k stable for 3 rounds.
- **6-category memory extraction from sessions:**
  - User: profile, preferences, entities, events
  - Agent: cases (problem→solution), patterns (reusable techniques)
  - Dedup pipeline: vector pre-filter → LLM decides skip/create/merge/delete
- **Heavyweight.** Python/Go/Rust stack, requires cloud LLM API keys, server process, config files. Not directly adoptable.

## Multi-Project Landscape (this repo as case study)

- **~2,000 markdown files across 25+ projects** under `~/git/0xcgn/`
- **17 projects have AGENTS.md** (49–858 lines each)
- **agents repo alone:** 143 md files, 9 extensions, 7 skills, 52 doc files, 3 expertise domains, 5 tracks
- **Scattered .pi directories:** agents (61 files), bip (17), qraiter-elixir (17), pi-mono (9), vault (3)
- **The real problem:** cross-project pattern recall. When in qraiter-elixir, you can't easily surface decisions from vault or patterns from agents.

## Comparison to Our Current System

| Dimension | Our System (pi) | QMD | OpenViking |
|-----------|----------------|-----|------------|
| Knowledge storage | `.pi/expertise/` YAML | SQLite + markdown collections | Virtual filesystem (AGFS + vector) |
| Content tiers | None (full domains injected) | None (chunks at 900 tokens) | L0/L1/L2 auto-generated |
| Search | Manual (grep, file reads) | BM25 + vector + RRF + reranking | Hierarchical vector + intent analysis |
| Memory evolution | Manual `expertise append` | None (pure search engine) | Auto-extraction (6 categories) |
| Session context | `.pi/tracks/` manual sync | None | Auto-archiving + compression |
| Stack | TypeScript/Bun | TypeScript/Bun ✅ | Python/Go/Rust ❌ |
| Infrastructure | Zero (repo files) | Zero (local SQLite + GGUF) | Server + API keys + config |
| Cost | $0 | $0 | Per-token API costs |
