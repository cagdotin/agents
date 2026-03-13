---
name: qmd
description: "Search markdown knowledge bases, notes, and documentation using QMD. Use proactively when you need to discover prior decisions, design patterns, specs, or how something works — not just when the user explicitly asks to search."
---

# QMD - Quick Markdown Search

Local, on-device hybrid search engine for markdown content. Combines BM25 full-text search, vector semantic search, and LLM re-ranking — all running locally.

## When to Use This

**Reach for qmd proactively** — don't wait for the user to ask. Use it when:

- You need to understand how something was designed or why a decision was made
- You're looking for prior art, patterns, or conventions in the repo
- You know *what* you need but not *where* it lives
- `rg`/`grep` would require knowing exact strings you don't have
- You want to find related specs, exec-plans, or resource summaries

**Use `rg`/`grep` instead** when you know the exact string, variable name, or file path.

## Important: Runtime Workaround (v2.0.1)

QMD's vector features crash under Bun because `bun:sqlite` silently replaces
`better-sqlite3` and uses Apple's system SQLite which has extension loading
disabled (`SQLITE_OMIT_LOAD_EXTENSION`). The launcher also falsely detects Bun
when `$BUN_INSTALL` is set, even for npm installs.

Fixes are in open PRs ([#377](https://github.com/tobi/qmd/pull/377),
[#385](https://github.com/tobi/qmd/pull/385)). Until they ship, force Node:

```bash
BUN_INSTALL="" qmd <command>
```

## Quick Reference

```bash
# Hybrid search (best quality — expansion + BM25 + vector + reranking)
BUN_INSTALL="" qmd query -c agents "your question"

# BM25 keyword search (fast, no LLM)
BUN_INSTALL="" qmd search "exact keywords" -c agents

# Structured query (you control sub-queries)
BUN_INSTALL="" qmd query $'lex: "connection pool" timeout\nvec: why do database connections time out'

# Get a specific document by path or docid
BUN_INSTALL="" qmd get "docs/ARCHITECTURE.md"
BUN_INSTALL="" qmd get "#abc123"

# Batch retrieve by glob
BUN_INSTALL="" qmd multi-get "docs/*.md" -l 40

# Check index health
BUN_INSTALL="" qmd status
```

## Query Types

| Type | Method | When to use |
|------|--------|-------------|
| `lex` | BM25 keywords | Know exact terms, names, code identifiers |
| `vec` | Vector similarity | Natural language question, don't know vocabulary |
| `hyde` | Vector (hypothetical) | Write 50-100 words of what the *answer* looks like |
| `expand` | Auto-expand | Single-line query — LLM generates lex/vec/hyde variations |

### Writing Good Queries

**lex (keyword):** 2-5 terms, no filler. Exact phrase: `"connection pool"`. Exclude: `-term`. Code identifiers work.
**vec (semantic):** Full natural language. Be specific: `"how does the rate limiter handle burst traffic"`.
**hyde (hypothetical document):** Write 50-100 words of what the answer looks like, using vocabulary you expect in results.
**expand (auto):** Just type a plain question — the local LLM generates lex/vec/hyde variations automatically.

### Intent (Disambiguation)

When a query term is ambiguous, add `intent:` on the first line:

```bash
BUN_INSTALL="" qmd query $'intent: web page load times\nlex: performance\nvec: how to improve performance'
```

### Combining Types

| Goal | Approach |
|------|----------|
| Know exact terms | `lex` only |
| Don't know vocabulary | Plain query (implicit expand) or `vec` |
| Best recall | `lex` + `vec` |
| Complex topic | `lex` + `vec` + `hyde` |
| Ambiguous query | Add `intent` to any combination |

First query gets 2× weight in fusion — put your best guess first.

## Collection Management

```bash
# Add a project as a collection
BUN_INSTALL="" qmd collection add ~/git/project --name project-name

# Add context annotations (travel with search results)
BUN_INSTALL="" qmd context add qmd://project-name "Description of this project"
BUN_INSTALL="" qmd context add qmd://project-name/docs "Project documentation"

# Generate embeddings after adding/updating
BUN_INSTALL="" qmd embed

# Re-index after file changes
BUN_INSTALL="" qmd update
BUN_INSTALL="" qmd embed

# List collections
BUN_INSTALL="" qmd collection list

# List indexed files
BUN_INSTALL="" qmd ls project-name
```

## Output Formats

```bash
# JSON (for scripting/agent processing)
BUN_INSTALL="" qmd query --json "question"

# Files list (docid, score, path, context)
BUN_INSTALL="" qmd query --files "question"

# Full document content
BUN_INSTALL="" qmd query --full "question"

# Score traces (debugging search quality)
BUN_INSTALL="" qmd query --json --explain "question"
```

## Setup

```bash
npm install -g @tobilu/qmd
BUN_INSTALL="" qmd collection add ~/path/to/project --name my-project
BUN_INSTALL="" qmd context add qmd://my-project "Description"
BUN_INSTALL="" qmd embed
```

Models (~2GB) auto-download on first use. Index lives at `~/.cache/qmd/index.sqlite`.
