---
title: "Agent Experts — Self-Improving Agents with Persistent Mental Models"
type: video
source: youtube
url: https://www.youtube.com/watch?v=zTcDwqopvKE
author: IndyDevDan
date_published: 2025-01-01
date_captured: 2026-03-05
tags:
  - agent-experts
  - self-improving
  - mental-model
  - expertise
  - meta-agentics
  - context-engineering
  - prompt-engineering
  - agent-orchestration
related:
  - "[[expert-extension]]"
status: reviewed
impact: foundational
description: >
  IndyDevDan introduces "Agent Experts" — agents that maintain persistent mental models
  (expertise files) per domain, self-improve after each task, and reuse accumulated knowledge.
  This video is the conceptual origin of our expert extension.
---

# Agent Experts — IndyDevDan

> **Origin video** for our [[expert-extension]]. The core philosophy, architecture patterns,
> and self-improvement loop described here directly shaped how we built it.

## Core Thesis

**The massive problem with agents: they forget. And forgetting means they don't learn.**

Traditional software improves as it's used (analytics, patterns, algorithms). Agents today
don't — every session starts from scratch. The "Agent Expert" concept solves this by making
agents that **execute AND learn**, maintaining persistent mental models that evolve over time.

## Key Concepts

### 1. The Problem with Current Solutions

| Approach | Limitation |
|----------|-----------|
| Memory files | Global forced context — always loaded. Must be manually updated. |
| Prime prompts / sub-agents / skills | Powerful but require manual updates to add new information. |
| Generic agents | Execute and forget. Need to be "booted up" from scratch every time. |

### 2. What is an Agent Expert?

> "A concrete form of a **self-improving template metaprompt**."

An agent expert is distinguished from a generic agent by one key factor:
- **Generic agent**: executes → forgets
- **Agent expert**: executes → learns → reuses expertise

The expertise is stored in a **mental model** — a data structure (YAML file) that evolves
over time. Each useful action accumulates information, examples, and domain knowledge.

### 3. The Expertise File — NOT a Source of Truth

> "This is not a source of truth. The mental model you have of your codebases — you don't
> have a source of truth in your mind. You have a working memory file. A mental model."

**The code is always the true source of truth.** The expertise file is a working memory —
like the mental model an engineer carries in their head. It helps the agent:
- Know where things are without searching
- Validate assumptions against the actual code
- Act faster because it has context already loaded

### 4. Meta-Agentics — The System That Builds the System

Three meta layers that increase output as an agentic engineer:

- **Meta Prompts** — prompts that generate prompts
- **Meta Agents** — agents that build agents
- **Meta Skills** — skills that create skills

> "Every codebase must have meta-agentics."

**Key distinction**: meta-agentics alone are NOT agent experts. They act, but they don't
learn. Nothing inside them updates automatically. An agent expert **must learn on its own**.

### 5. The Self-Improve Loop

The three-step agentic workflow:

```
1. PLAN   → Create a plan for the task
2. BUILD  → Execute against the plan (source of truth updates)
3. LEARN  → Self-improve prompt syncs the mental model with changes
```

Step 3 is what makes it an expert system. After building, the agent runs a self-improve
prompt that updates the expertise file to reflect what changed. No human in the loop.

### 6. Domain-Specific Experts

Each expert owns a specific area of the codebase:
- **Database expert** — knows all tables, relationships, migration patterns
- **WebSocket expert** — knows all events, handlers, communication flows

When asked a question, the expert:
1. Reads its expertise file first
2. Validates its mental model against the actual code
3. Only then acts/reports

> "There's no searching here. There's just validating its mental model."

### 7. Scaling with Multiple Experts

Multiple agents can be deployed against the same problem:
- 3-5 agents answering the same question increases confidence
- One agent might find something others miss
- An orchestrator synthesizes all results
- "Sometimes if you throw five agents at the problem, only one makes it"

### 8. The Core Four

Everything reduces to:

1. **Context** — what the agent knows
2. **Model** — which LLM
3. **Prompt** — what you tell it
4. **Tools** — what it can do

> "Everything is just the core four with some fancy tooling and a little bit of code structure."

## Quotes Worth Remembering

- "The moment they stop learning — that's the one condition where the game ends."
- "You don't need to tell an expert to learn. It's in their DNA."
- "You're not trying to solve every problem. You're trying to solve the one that matters most."
- "Three times marks a pattern → move it into automation."
- "Build whatever abstraction you want. I always focus on the foundational units."

## How This Shaped Our Implementation

| Video Concept | Our Implementation |
|--------------|-------------------|
| Expertise YAML files per domain | `.pi/expertise/*.yaml` managed by expert extension |
| Self-improve prompt after actions | `expertise reflect` — explicit, user-triggered |
| Read expertise first, validate against code | Auto-injection via `before_agent_start` hook |
| Domain-scoped experts | `scope.paths` in expertise header |
| Mental model, not source of truth | Documented in tool description + CONTENT_PRINCIPLES |
| Meta-expert for generating new experts | `expertise init` bootstraps from scope paths |

### Where We Diverged

- **Explicit reflection over automatic**: Dan's agents self-improve automatically at step 3.
  We made reflection explicit (user-triggered) because auto-reflect blocked the next prompt
  and ran on every cycle regardless of relevance.
- **Integrated extension over standalone prompts**: Dan uses separate prompt files and
  sub-agents. We built it as a pi extension with tool + slash command for tighter integration.
- **Router-based domain matching**: Dan's experts are invoked by name. We added a router
  that identifies which domains are affected and fans out reflection in parallel.

## Open Questions / Food for Thought

- Should we move toward more automatic self-improvement? Perhaps opt-in per domain?
- Dan mentions "product-focused agent experts" for adaptive UX — we haven't explored this.
- The orchestration pattern (multiple experts on one question) could be powerful for our
  reflection — instead of one reflection pass, have multiple perspectives.

---

*Transcript captured: 2026-03-05. Video may have been updated since.*
