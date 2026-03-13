# Report

## Status: Layer 1 complete, ready for use

QMD is installed globally and the agents repo is indexed as the first collection. Search quality is validated.

## What's done

1. **QMD installed globally** via `npm install -g @tobilu/qmd`
2. **Agents collection created**: 92 markdown files indexed, 263 chunks embedded
3. **7 context annotations** set across subcollections (root, .pi, docs, extensions, skills, resources, exec-plans)
4. **3 GGUF models downloaded** (~2GB total): embedding (300M), reranker (600M), query expansion (1.7B)
5. **QMD skill installed** at `~/.agents/skills/qmd/SKILL.md`
6. **Search quality validated** with 3 test queries — results are relevant and correctly ranked

## How to use

```bash
# Search this project
BUN_INSTALL="" qmd query -c agents "your question"

# BM25 keyword search (fast, no LLM)
BUN_INSTALL="" qmd search "exact term" -c agents

# Add another project
BUN_INSTALL="" qmd collection add ~/git/0xcgn/PROJECT --name PROJECT
BUN_INSTALL="" qmd context add qmd://PROJECT "Description of what this project is"
BUN_INSTALL="" qmd embed

# Cross-project search (omit -c)
BUN_INSTALL="" qmd query "your question"

# Update index after changes
BUN_INSTALL="" qmd update
BUN_INSTALL="" qmd embed
```

## Known issue: Bun compatibility

QMD requires Node (not Bun) due to sqlite-vec extension loading. The `BUN_INSTALL=""` prefix forces the QMD launcher to use Node instead of Bun. This is because the launcher script checks `$BUN_INSTALL` env var and routes to Bun if set.

## What's next

- **Layer 2**: Pi extension wrapping QMD with auto-project-detection, `/qmd` command, and session lifecycle hooks
- **Layer 3**: Expertise domains become thin pointers; QMD becomes the deep retrieval layer
- **More collections**: Add projects as needed — each is `qmd collection add` + `qmd context add` + `qmd embed`
