---
title: "Cognee — Memory Layer for AI Agents (Knowledge Graphs + Vector Stores)"
type: talk
source: youtube
url: https://www.youtube.com/watch?v=E8-is7OH3UI
author: Vasili (Cognee founder)
date_captured: 2026-03-21
tags:
  - agent-memory
  - knowledge-graphs
  - rag
  - feedback-loops
  - memory-domains
  - multi-agent
  - neo4j
related:
  - "[[agent-experts-indydevdan]]"
  - "[[agent-memory track]]"
status: reviewed
impact: informative
description: >
  Cognee founder demos a multi-agent customer support system where agents use
  knowledge graphs + vector stores as a shared memory layer, with scoped memory
  domains per agent and feedback loops that improve future retrieval.
---

# Cognee — Memory Layer for AI Agents

> Talk at a Berlin Neo4j meetup. Vasili (founder of Cognee) demos how agents use
> structured memory built on knowledge graphs + vector stores to investigate,
> reason, and share state across sessions.

## Summary

Cognee is an open-source (~10k GitHub stars) memory layer for AI agents. It
addresses two failures: RAG that can't disambiguate or stay fresh, and agents
that forget everything between sessions. Their solution layers knowledge graphs
(Neo4j) on top of vector embeddings, with a "cognify" pipeline that transforms
raw data into structured graph+vector representations automatically.

The demo shows a multi-agent customer support scenario: a billing agent, support
agent, and supervisor agent each investigate a workspace access issue through
scoped memory domains, then the supervisor stitches their findings together.

## Key Ideas

### Memory Domain Isolation

Agents get access only to specific "note sets" — isolated memory regions scoped
to their role (billing data, support tickets, contracts). This prevents
over-broad context and enforces least-privilege access to memory.

**Our parallel:** Expertise domains with `scope.paths` achieve the same isolation
at the file/directory level. Tracks scope workstream context similarly.

### Session Memory vs. Permanent Memory

Each agent maintains an independent session (ephemeral reasoning state) plus
access to permanent shared memory (the knowledge graph). Session findings can
be persisted back into permanent memory.

**Our parallel:** Tracks (session/workstream) vs. expertise (permanent/domain)
is exactly this split — already implemented.

### The Feedback Loop (Most Transferable Idea)

After investigating an issue, the billing agent generates "instructions for
future queries" — e.g., "I should search invoice payment status AND billing
account status together" and "webhook reconciliation timing should be checked."

These instructions are fed back into the memory system as structured feedback,
which changes how future retrieval works. On the next search, results are more
detailed and on-point because the system now knows which signals to correlate.

**This is the idea worth studying further for us.** Currently our promotion flow
is: session findings → track files → expertise append. But the feedback is
passive — it enriches the expertise file, but doesn't actively reshape how QMD
queries are constructed or expanded. A possible extension:

- Expertise domains could accumulate "query hints" — patterns the agent learned
  about what to search for together, what terms are ambiguous, or what contexts
  require cross-domain lookup.
- These hints could feed into QMD query expansion or inform the agent's search
  strategy before it even runs `qmd query`.
- This would close the loop: act → learn → search better next time.

### Cognify Pipeline

Raw data (PDFs, relational records, unstructured text) goes through a
transformation pipeline that produces graph + vector representations. This is
automatic — you `add` data then `cognify` it.

**Our parallel:** `expertise init` bootstraps from scope paths, but it's a
one-shot operation. The cognify concept suggests value in re-processing sources
periodically to keep representations fresh.

### Ontologies as Contract Terms

Cognee uses "ontologies" — structured rule definitions — as the source of truth
for what should be correct at each stage. In the demo, contract terms define
what access level a customer should have, which agents use to detect mismatches.

**Our parallel:** We don't have explicit ontologies, but AGENTS.md golden rules
and extension READMEs serve a similar "what should be true" role.

## What's Different From Our Approach

| Aspect | Cognee | Our stack |
|--------|--------|-----------|
| Infrastructure | Neo4j + embedding models + LLM calls | Local-first, file-based, zero infra |
| Memory format | Knowledge graph + vector store | YAML expertise + markdown + QMD index |
| Agent model | Multi-agent runtime coordination | Single-agent, repo-embedded context |
| Stack | Python / Pydantic | TypeScript / Bun |
| Retrieval | Graph traversal + vector search + 10-15 retrievers | QMD hybrid (BM25 + vector + reranking) |

## How This Relates to Our Repo

- **Validates patterns we already have**: domain isolation, session/permanent split,
  structured representations over raw embeddings.
- **Feedback loop idea** connects to our open checklist item: "Decide promotion flow:
  session findings → track files → expertise append."
  See: `.pi/tracks/agent-memory/summary.md` → Open checklist.
- **Does not change our architecture** — Cognee operates at a fundamentally different
  abstraction level (infrastructure-heavy, multi-agent runtime). Our local-first,
  file-based approach remains the right fit.

## Extracted Links

| Link | Context |
|------|---------|
| https://github.com/topoteretes/cognee | Cognee open-source repo |
| https://github.com/topoteretes/cognee-langgraph | Demo code from this talk (multi-agent + Cognee + LangGraph) |

## Actionable Follow-Ups

- [ ] Explore "query hints" concept: could expertise domains accumulate search
      strategy notes that improve how agents construct QMD queries?
- [ ] Reference this when designing the promotion flow (session → track → expertise)

---

*Transcript captured: 2026-03-21 via youtube-transcript skill. Talk at Berlin Neo4j meetup.*
