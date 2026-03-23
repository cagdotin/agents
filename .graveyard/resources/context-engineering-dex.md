---
title: "Advanced Context Engineering for Coding Agents"
type: talk
source: youtube
url: https://www.youtube.com/watch?v=rmvDxxNubIg
author: Dex
date_captured: 2026-03-05
tags:
  - context-engineering
  - compaction
  - research-plan-implement
  - brownfield
  - coding-agents
  - smart-zone
  - sub-agents
  - mental-alignment
  - slop
  - workflow
related:
  - "[[agent-experts-indydevdan]]"
status: reviewed
impact: foundational
description: >
  Dex presents "Advanced Context Engineering for Coding Agents" at AI Engineer.
  Introduces the "dumb zone" concept (~40% context usage = diminishing returns),
  the Research → Plan → Implement workflow with frequent intentional compaction,
  and why sub-agents exist to control context — not to anthropomorphize roles.
---

# Advanced Context Engineering for Coding Agents — Dex

> **Origin of**: Research → Plan → Implement (RPI) workflow, "dumb zone" concept,
> frequent intentional compaction. Went viral on HackerNews in September 2025.

## Core Thesis

**LLMs are stateless. The only lever you have is what goes into the context window.**
Better tokens in → better tokens out. Every tool call, every turn — the model picks
the next step based solely on what's in the conversation so far. Optimize for
correctness, completeness, size, and trajectory.

## Key Concepts

### 1. The Problem: Slop in Brownfield Codebases

DORA/Eigor survey of 100k developers: AI dramatically increases shipping velocity, but
much of the output is reworking slop from last week. AI works great for greenfield dashboards;
falls apart in 10-year-old Java codebases. The gap is **context engineering** — getting the
most out of today's models.

### 2. The Dumb Zone

| Context Usage | Zone | Behavior |
|--------------|------|----------|
| 0–40% | Smart zone | Model makes good decisions, picks right tools |
| 40%+ | Dumb zone | Diminishing returns, poor tool selection, more errors |

The exact threshold depends on task complexity, but ~40% is a useful guideline.
**If you have too many MCPs dumping JSON/UUIDs into your context, you're doing
all your work in the dumb zone.**

### 3. Negative Trajectory Trap

When you correct the model, yell at it, it corrects, you yell again — the conversation
trajectory predicts more failure. The model sees: "I did wrong → human yelled → I did
wrong → human yelled" and continues the pattern. **If you see the model apologizing
repeatedly, start a fresh context.**

### 4. Intentional Compaction

Instead of letting context grow until it degrades, **proactively compress**:
- Ask the agent to summarize current progress into a markdown file
- Review and tag the summary
- Start a new context with just the compressed summary
- New agent gets straight to work instead of re-exploring

**What to compact**: exact files and line numbers that matter, current understanding
of the problem, decisions made so far. **What wastes context**: file searches,
full file reads, test output, MCP JSON dumps.

### 5. Sub-Agents Are for Context Control

> "Sub-agents are NOT for anthropomorphizing roles. They are for controlling context."

Don't create "frontend agent" and "backend agent." Instead, fork a sub-agent to
**explore and compress**: it reads files, traces code flow, burns through its own
context window, then returns a succinct summary to the parent agent. Parent reads
one file and gets to work — smart zone preserved.

### 6. Research → Plan → Implement (RPI)

Three phases, each producing a compressed artifact:

| Phase | Purpose | Output |
|-------|---------|--------|
| **Research** | Understand how the system works | Compressed truth — files, line numbers, code flow |
| **Plan** | Outline exact steps with code snippets | Compression of intent — reviewable, executable |
| **Implement** | Execute the plan in a fresh context | Code changes, tested after each step |

**Key properties:**
- Each phase compacts into a file that feeds the next phase
- Plans include actual code snippets of what will change
- After each phase, context is fresh — always in the smart zone
- The human reviews research and plans (highest leverage review point)

### 7. Don't Outsource the Thinking

> "AI cannot replace thinking. It can only amplify the thinking you have done
> or the lack of thinking you have done."

- A bad line of code = 1 bad line
- A bad step in a plan = 100 bad lines
- A wrong assumption in research = the whole thing is hosed

**You MUST read the plans.** The value of RPI comes from the human in the loop
validating correctness at each stage.

### 8. Mental Alignment via Plans

Code review's real purpose: keeping the team mentally aligned on how the codebase
evolves and why. As you ship 2-3x more code:
- Share plans for peer review before implementation
- Attach AMP threads to PRs (Mitchell Hashimoto pattern)
- Plans are readable by humans; 1000-line diffs are not

### 9. Scaling Effort to Task Complexity

| Task Complexity | Approach |
|----------------|----------|
| Change button color | Just talk to the agent |
| Small feature | Quick plan, implement |
| Medium feature, multi-repo | Research → Plan → Implement |
| Complex system change | Multiple research passes, detailed plans with code snippets |

> "It takes reps. You will get it wrong. Pick one tool and get some reps."

### 10. On-Demand Context > Static Documentation

Static onboarding docs (CLAUDE.md, etc.) have a problem: **they go stale**.
The more documentation you maintain, the more lies accumulate. Prefer **on-demand
compressed context** — generate research from the actual code at task time.
This gives you truth, not outdated documentation.

Progressive disclosure still works: root-level overview + per-directory context
pulled in only when working in that area. But keep it minimal and regenerate often.

## Proof Points

- **300k-line Rust codebase (BAML)**: One-shot fix using RPI. CTO approved the PR
  next morning without knowing it was for a podcast demo.
- **35k lines shipped in 7 hours**: Dex + Vib sat down on a Saturday, shipped ~1-2
  weeks of estimated work using RPI against BAML.
- **Parquet Java (failure case)**: Removing Hadoop dependencies. RPI wasn't enough —
  had to go back to whiteboard. Shows the ceiling: when the problem requires
  architectural thinking, no amount of context engineering saves you.

## Spec-Driven Dev is Semantically Diffused

> "There will never be a year of agents because of semantic diffusion." — Martin Fowler (2006)

"Spec-driven development" now means 6 different things to 6 different people:
a better prompt, a PRD, verifiable feedback loops, treating code as assembly,
using markdown files while coding, or just documentation. **The term is dead.**
Focus on the mechanics: compaction, context engineering, staying in the smart zone.

## How This Relates to Our Work

| Dex's Concept | Our Implementation |
|--------------|-------------------|
| Frequent intentional compaction | `expertise reflect` — compress learnings into persistent domain files |
| Sub-agents for context control | Pi sub-agent patterns (spawn, compress, return summary) |
| On-demand compressed context | Expertise files as pre-loaded compressed context per domain |
| Progressive disclosure of docs | `scope.paths` in expertise — only inject relevant domains |
| Don't outsource the thinking | Human reviews plans/research; expertise is mental model, not source of truth |
| Negative trajectory → fresh context | Start new pi sessions rather than correcting in degraded context |
| Smart zone preservation | Keep expertise files concise; router selects only affected domains |

## Quotes Worth Remembering

- "LLMs are stateless. The only way to get better performance is to put better tokens in."
- "Sub-agents are not for anthropomorphizing roles. They are for controlling context."
- "AI cannot replace thinking. It can only amplify the thinking you have done or the lack of thinking you have done."
- "A bad line of research — a misunderstanding of how the system works — your whole thing is going to be hosed."
- "If you see [the model apologizing], it's probably time to start over."
- "Mind your trajectory."
- "There is no perfect prompt. There is no silver bullet."

---

*Transcript captured: 2026-03-05.*
