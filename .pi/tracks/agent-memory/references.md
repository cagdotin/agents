# References

## Primary Research Source
- Fireship video (2026-03-12): https://www.youtube.com/watch?v=Xn-gtHDsaPY
  - Covered 7 OSS tools; 2 are memory-relevant (QMD, OpenViking)

## QMD — Query Markup Documents
- **Repo:** https://github.com/tobi/qmd (15k★, MIT, TypeScript/Bun)
- **Author:** Tobi Lütke (Shopify CEO)
- **Docs:** README covers full architecture, search pipeline, SDK API
- **CLAUDE.md:** repo has its own agent instructions file
- **SDK:** `@tobilu/qmd` on npm — `createStore()` API
- **MCP:** stdio + HTTP transport, Claude Code plugin available
- **Changelog:** v2.0 shipped 2026-03-10 (stable SDK API)

## OpenViking — Context Database for AI Agents
- **Repo:** https://github.com/volcengine/OpenViking (7.7k★, Apache 2.0, Python/Go/Rust)
- **Author:** ByteDance/Volcengine
- **Docs:** `docs/en/concepts/` — 8 concept docs covering architecture, context types, layers, retrieval, sessions, storage, extraction
- **Website:** https://www.openviking.ai
- **Key docs read:**
  - `01-architecture.md` — system overview, module responsibilities, data flow
  - `02-context-types.md` — Resource/Memory/Skill taxonomy, 6 memory categories
  - `03-context-layers.md` — L0/L1/L2 model, generation mechanism, best practices
  - `05-storage.md` — dual-layer AGFS + vector index, VikingFS abstraction
  - `06-extraction.md` — parser pipeline, tree builder, semantic queue, AST mode
  - `07-retrieval.md` — intent analysis, hierarchical retrieval algorithm, reranking
  - `08-session.md` — session lifecycle, compression, 6-category memory extraction, dedup
  - `06-mcp-integration.md` — MCP server setup for Claude Code, Cursor, etc.
