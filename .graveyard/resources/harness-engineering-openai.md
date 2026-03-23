---
title: "Harness Engineering: Leveraging Codex in an Agent-First World"
type: article
source: blog
url: https://openai.com/index/harness-engineering/
author: Ryan Lopopolo (OpenAI)
date_published: 2026-02-11
date_captured: 2026-03-06
tags:
  - agent-first
  - codex
  - harness-engineering
  - context-engineering
  - AGENTS.md
  - progressive-disclosure
  - agent-legibility
  - linting
  - architecture-enforcement
  - garbage-collection
  - agent-review
  - coding-agents
  - autonomy
related:
  - "[[context-engineering-dex]]"
  - "[[agent-experts-indydevdan]]"
status: reviewed
impact: foundational
description: >
  OpenAI's account of building an internal product with 0 lines of manually-written code
  over 5 months using Codex agents. ~1M lines of code, ~1500 PRs, 3 engineers. Core lesson:
  the engineer's job shifts from writing code to designing environments, specifying intent,
  and building feedback loops. AGENTS.md should be a table of contents, not an encyclopedia.
---

# Harness Engineering — OpenAI (Ryan Lopopolo)

> **Key claim**: A small team (3→7 engineers) shipped ~1M lines of code via ~1,500 PRs in
> 5 months with **zero manually-written code**. Estimated 10x speed vs hand-coding. Every
> artifact — product code, tests, CI, docs, tooling, dashboards — was agent-generated.

## Summary

OpenAI built and shipped an internal beta product from an empty git repo (August 2025)
using only Codex agents. Humans never directly wrote code — they steered via prompts,
designed environments, and built feedback loops. The article distills what they learned
about making agents productive at scale.

## Core Principles

### 1. Humans Steer, Agents Execute

The engineer's role shifts from writing code to:
- Breaking goals into smaller building blocks
- Identifying missing capabilities when agents fail ("what's missing?" not "try harder")
- Translating user feedback into acceptance criteria
- Validating outcomes

### 2. AGENTS.md as Table of Contents, Not Encyclopedia

The "one big AGENTS.md" approach failed for four reasons:
1. **Context is scarce** — a giant file crowds out the actual task
2. **Too much guidance = non-guidance** — when everything is important, nothing is
3. **It rots instantly** — becomes a graveyard of stale rules
4. **Hard to verify** — no mechanical checks for freshness or coverage

**Fix**: Short AGENTS.md (~100 lines) as a map, with pointers to a structured `docs/`
directory that serves as the system of record. This enables **progressive disclosure** —
agents start with a small entry point and navigate deeper as needed.

### 3. Agent Legibility Over Human Legibility

The codebase is optimized for Codex's legibility first. Anything the agent can't access
in-context while running effectively doesn't exist. Slack discussions, Google Docs,
tribal knowledge — if it's not in the repo, it's illegible to the agent.

### 4. Enforce Architecture Mechanically

- Rigid layer model: Types → Config → Repo → Service → Runtime → UI
- Cross-cutting concerns enter through a single Providers interface
- Custom linters (agent-generated) enforce dependency directions, naming, logging, file size
- Lint error messages include remediation instructions — injected into agent context
- Principle: "enforce boundaries centrally, allow autonomy locally"

### 5. Repository Knowledge as System of Record

```
docs/
├── design-docs/       # Catalogued, indexed, verification status tracked
├── exec-plans/        # First-class artifacts with progress/decision logs
│   ├── active/
│   ├── completed/
│   └── tech-debt-tracker.md
├── generated/         # Auto-generated docs (e.g. db-schema.md)
├── product-specs/
├── references/        # LLM-friendly reference docs (design-system, etc.)
├── DESIGN.md
├── FRONTEND.md
├── QUALITY_SCORE.md   # Grades each domain/layer, tracks gaps over time
└── SECURITY.md
```

Enforced mechanically: linters + CI validate freshness, cross-links, structure.
A recurring "doc-gardening" agent scans for stale docs and opens fix-up PRs.

### 6. Entropy and Garbage Collection

Agents replicate patterns that exist — even bad ones. Initially 20% of engineer time
went to cleanup ("AI slop Fridays"). Replaced with:
- **Golden principles** encoded in the repo (prefer shared utils over hand-rolled helpers,
  validate at boundaries, no YOLO probing)
- **Recurring background agents** that scan for deviations, update quality grades, and
  open targeted refactoring PRs
- Most cleanup PRs reviewable in <1 minute, automerged

> "Technical debt is like a high-interest loan: better to pay it down continuously
> in small increments than to let it compound."

### 7. Throughput Changes Merge Philosophy

With high agent throughput: minimal blocking merge gates, short-lived PRs, test flakes
addressed with follow-up runs. Corrections are cheap; waiting is expensive.

### 8. Increasing Levels of Autonomy

At maturity, a single prompt can drive end-to-end:
1. Validate codebase state
2. Reproduce bug + record video
3. Implement fix + validate + record resolution video
4. Open PR, respond to feedback, detect/fix build failures
5. Escalate to human only when judgment required
6. Merge

Single Codex runs regularly work 6+ hours on a single task (often overnight).

## Techniques Worth Noting

| Technique | Detail |
|-----------|--------|
| **Ralph Wiggum Loop** | Agent reviews its own changes, requests additional agent reviews, responds to feedback, iterates until all agent reviewers are satisfied |
| **App per worktree** | App bootable per git worktree — each Codex instance gets isolated app + logs + metrics, torn down after task |
| **Chrome DevTools Protocol** | Wired into agent runtime for DOM snapshots, screenshots, navigation — agents can drive UI directly |
| **Observability as agent context** | LogQL/PromQL queries available to agents — enables prompts like "ensure startup < 800ms" |
| **Boring technology preference** | Composable, stable APIs with good training-set representation. Sometimes cheaper to reimplement than wrap opaque libraries |
| **Parse at the boundary** | Data shapes validated at entry points (team prefers Zod, but not prescribed) |

## Links Referenced in the Article

| Link | Context |
|------|---------|
| [AGENTS.md spec](https://agents.md/) | The AGENTS.md convention for directing agent behavior |
| [ARCHITECTURE.md](https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html) | matklad's post on architecture documentation |
| [Codex execution plans](https://cookbook.openai.com/articles/codex_exec_plans) | OpenAI cookbook: how to use execution plans with Codex |
| [Ralph Wiggum Loop](https://ghuntley.com/loop/) | Agent self-review loop pattern |
| [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) | Alexis King's influential post on data validation |
| [AI is forcing us to write good code](https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code) | On how agent-first dev demands better architecture |
| [Introducing Aardvark](https://openai.com/index/introducing-aardvark/) | OpenAI's Aardvark agent, also operates on the codebase |

### Related OpenAI Engineering Posts

- [Unlocking the Codex harness: how we built the App Server](https://openai.com/index/unlocking-the-codex-harness/) (Feb 4, 2026)
- [Inside OpenAI's in-house data agent](https://openai.com/index/inside-our-in-house-data-agent/) (Jan 29, 2026)
- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) (Jan 23, 2026)

## How This Relates to Our Work

| Their Concept | Our Implementation |
|--------------|-------------------|
| AGENTS.md as table of contents with progressive disclosure | Expertise files as scoped, auto-injected domain context (not one giant file) |
| Repository knowledge as system of record | `docs/resources/` for external context, `.pi/expertise/` for domain mental models |
| Agent legibility — push context into repo | Expertise `scope.paths` ensures relevant context is discoverable |
| Mechanical enforcement of architecture | Custom linters — we could build pi extensions that validate conventions |
| Entropy / garbage collection agents | `expertise reflect` — periodic compression of learnings, prune stale insights |
| Golden principles encoded in repo | `CONTENT_PRINCIPLES` in expert extension — encoded taste for what belongs |
| Doc-gardening agent | Could add a recurring skill that audits expertise freshness |
| Parse at the boundary | Matches our StringEnum pattern — validate tool inputs at the boundary |
| Boring technology preference | Aligns with "cheap model for LLM calls" — use the simplest thing that works |

## Quotes Worth Remembering

- "Humans steer. Agents execute."
- "Give Codex a map, not a 1,000-page instruction manual."
- "When everything is 'important,' nothing is."
- "From the agent's point of view, anything it can't access in-context while running effectively doesn't exist."
- "The fix was almost never 'try harder.' ...human engineers always asked: 'what capability is missing?'"
- "In a human-first workflow, these rules might feel pedantic or constraining. With agents, they become multipliers."
- "Building software still demands discipline, but the discipline shows up more in the scaffolding rather than the code."

---

*Captured: 2026-03-06. Source archived at [Wayback Machine](https://web.archive.org/web/20260211221555/https://openai.com/index/harness-engineering/).*
