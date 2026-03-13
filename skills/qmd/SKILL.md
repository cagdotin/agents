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

## Quick Reference

```bash
# Hybrid search (best quality — expansion + BM25 + vector + reranking)
qmd query -c agents "your question"

# BM25 keyword search (fast, no LLM)
qmd search "exact keywords" -c agents

# Structured query (you control sub-queries)
qmd query $'lex: "connection pool" timeout\nvec: why do database connections time out'

# Get a specific document by path or docid
qmd get "docs/ARCHITECTURE.md"
qmd get "#abc123"

# Batch retrieve by glob
qmd multi-get "docs/*.md" -l 40

# Check index health
qmd status
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
qmd query $'intent: web page load times\nlex: performance\nvec: how to improve performance'
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
qmd collection add ~/git/project --name project-name

# Add context annotations (travel with search results)
qmd context add qmd://project-name "Description of this project"
qmd context add qmd://project-name/docs "Project documentation"

# Generate embeddings after adding/updating
qmd embed

# Re-index after file changes
qmd update
qmd embed

# List collections
qmd collection list

# List indexed files
qmd ls project-name
```

## Output Formats

```bash
# JSON (for scripting/agent processing)
qmd query --json "question"

# Files list (docid, score, path, context)
qmd query --files "question"

# Full document content
qmd query --full "question"

# Score traces (debugging search quality)
qmd query --json --explain "question"
```

## Setup

```bash
npm install -g @tobilu/qmd
qmd collection add ~/path/to/project --name my-project
qmd context add qmd://my-project "Description"
qmd embed
```

Models (~2GB) auto-download on first use. Index lives at `~/.cache/qmd/index.sqlite`.

## Local Fork

We run a local fork at `~/git/qmd-fork` that applies two unmerged upstream PRs:

- **PR #377** — `Database.setCustomSQLite()` with Homebrew SQLite on macOS, so `bun:sqlite` can load sqlite-vec extensions. Requires `brew install sqlite`.
- **PR #385** — launcher prioritizes `package-lock.json` over `bun.lock` to prevent false Bun detection; fixes `cleanupOrphanedVectors()` crash.

When upstream merges these, switch back to `npm install -g @tobilu/qmd`.
