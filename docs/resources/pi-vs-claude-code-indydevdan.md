---
title: "Pi vs Claude Code — Customizing Your Agent Coding Tool"
type: video
source: youtube
url: https://www.youtube.com/watch?v=f8cfH5XX-XU
author: IndyDevDan
date_published: 2025-07-01
date_captured: 2026-03-05
tags:
  - pi-agent
  - claude-code
  - extensions
  - agent-harness
  - multi-agent
  - orchestration
  - agent-chains
  - agent-teams
  - customization
  - damage-control
  - meta-agents
  - specialization
related:
  - "[[agent-experts-indydevdan]]"
  - "[[extensions-dev]]"
  - "[[expert-extension]]"
status: reviewed
impact: foundational
description: >
  IndyDevDan's deep-dive into Pi as a fully customizable agent coding tool.
  Demonstrates 3 tiers of Pi customization: basic harness (widgets, footers, themes),
  multi-agent orchestration (teams, chains, sub-agents), and meta-agents.
  Companion repo: github.com/indydevdan/pi-vs-cc (cloned locally).
---

# Pi vs Claude Code — IndyDevDan

> **Companion repo**: `/Users/cgn/git/dev/0xcgn/cool-projects/pi-vs-claude-code`
> Contains 16 extensions demonstrating every concept from the video.

## Core Thesis

**Your agent coding tool limits what you believe is possible.** Claude Code is the leader
with great defaults, but it's a closed, for-profit product that must grow to serve the
masses. Pi is the open-source counterattack — minimal by design, customizable to the core.
The strategy: bet big on the leader (Claude Code ~80%), hedge with open source (Pi ~20%)
for deep customization and experimental next-gen agent coding.

## Video Structure — Three Tiers

### Tier 1: Agent Harness Basics

Extensions compose via `-e` flags. Each is a standalone `.ts` file.

| Extension | What It Proves |
|-----------|----------------|
| **pure-focus** | Strip everything — distraction-free mode (24 lines) |
| **minimal** | Custom footer with model + context meter |
| **tool-counter** | Rich 2-line footer: model, branch, cwd, per-tool tally, cost |
| **tool-counter-widget** | Live-updating widget above editor showing tool call counts |
| **cross-agent** | Load commands/skills/agents from `.claude/`, `.gemini/`, `.codex/` dirs |
| **purpose-gate** | Force declaring session intent; appends purpose to system prompt |
| **theme-cycler** | 13 custom themes, Ctrl+X/Q to cycle |
| **tilldone** | Task discipline — agent MUST define tasks before doing work |

**Key Insights:**
- Extensions stack: `pi -e a.ts -e b.ts -e c.ts` — composable units
- Widgets persist across the session (above-editor UI)
- Footer/status line is fully customizable
- Hooks can block tool calls (tilldone blocks tools until tasks are defined)
- Pi has ~200 token system prompt vs Claude Code's ~10k — "let the model cook"
- Pi runs in YOLO mode by default — no permission theater

### Tier 2: Agent Orchestration

| Extension | Pattern |
|-----------|---------|
| **subagent-widget** | `/sub <task>` spawns background Pi processes with live streaming widgets |
| **agent-team** | Dispatcher orchestrator — primary agent delegates to specialist agents |
| **agent-chain** | Sequential pipeline — output of step N becomes input to step N+1 |
| **system-select** | `/system` switches agent persona/system-prompt on the fly |
| **damage-control** | Real-time safety hooks — regex blocks on bash, path-based access control |

**Key Insights:**
- Pi has NO built-in sub-agent support — you build it yourself via `child_process.spawn`
- Agents are `.md` files with YAML frontmatter: name, description, tools, system prompt
- Teams defined in `teams.yaml` — named groups of agents for different workflows
- Chains defined in `agent-chain.yaml` — `$INPUT` (previous output) and `$ORIGINAL` (user prompt) variables
- Damage control uses a YAML rules file with bash regex patterns + path access tiers
  (zero-access, read-only, no-delete)

### Tier 3: Meta-Agents

| Extension | Pattern |
|-----------|---------|
| **pi-pi** | Meta-agent with 8 domain experts that runs parallel research to build new Pi agents |

**Key Insight:** Once you're building specialized agents, create a meta-agent that builds
agents for you. Each expert knows one slice of the Pi framework (extensions, themes, TUI,
skills, config, prompts, agents, CLI). The orchestrator queries them in parallel, synthesizes
findings, and writes the actual extension files.

## Design Philosophy Comparison

| Aspect | Claude Code | Pi |
|--------|------------|-----|
| System prompt | ~10k tokens, opinionated | ~200 tokens, minimal |
| Safety | 5 modes, confirm everything | YOLO by default, build your own |
| Models | Anthropic-first | Any model, any provider |
| Customization | Decent (hooks, MCP, skills) | Everything (system prompt, tools, hooks, UI, themes, keybindings) |
| Sub-agents | Native (task tool, teams) | Build it yourself |
| MCP | Full support | No support (use CLI/skills instead) |
| Hooks | Essential lifecycle events | 25+ plug-in points across all lifecycle stages |
| Target | Everyone — PMs, designers, vibe coders | Advanced mid-senior+ engineers |
| Source | Closed, for-profit | Open source (pin version, fork, customize) |

## Hooks Comparison (Subset)

Pi has significantly more hooks than Claude Code:

- **Session**: both have start/end
- **Tool**: Pi has `tool_call`, `tool_result`, `tool_execution_start/update/end` — finer grained
- **Agent/Turn**: Pi has `before_agent_start`, `agent_start/end`, `turn_start/end` — CC has none
- **Branching**: Pi has fork/switch/tree events — CC has none
- **Message**: Pi has `message_start/update/end` — CC has none
- **Bash**: Pi has `BashSpawnHook`, `user_bash` — CC has none
- **Sub-agents**: CC has native events — Pi has none (build your own)

## Actionable Ideas for Our Workflow

### High-Impact — Should Build

1. **Damage Control Extension** — Safety hooks that block destructive commands via regex
   patterns and enforce path-based access control. His YAML rules file is comprehensive
   (bash patterns, zero-access paths, read-only paths, no-delete paths). We operate in
   YOLO mode — this is the responsible way to do it.

2. **Agent Team / Chain System** — Declarative YAML configs for agent teams and sequential
   pipelines. Our current workflow is single-agent. Having a `plan → build → review` chain
   or a `scout + builder + reviewer` team would be powerful.

3. **Purpose Gate** — Simple but effective: force declaring session intent, append to system
   prompt, show persistent widget. Prevents drift. Tiny extension (~84 lines).

4. **TillDone Task Discipline** — Agent must define tasks before working, must complete them
   before stopping. Adds determinism to the agent loop via hooks. Forces structured work.

### Medium-Impact — Worth Exploring

5. **Sub-Agent Widget** — Spawn background agents for parallel work. Each gets its own
   session and streaming progress widget. Useful for research/exploration tasks.

6. **Cross-Agent Loading** — Scan `.claude/`, `.gemini/`, `.codex/` for commands/skills/agents
   and register them in Pi. We already work across tools — this bridges them.

7. **Theme System** — 13+ custom themes with cycling shortcuts. Our current theming is
   stock. Custom themes improve readability and reduce eye strain.

8. **Tool Counter / Observability** — Real-time tool call tracking in footer/widget.
   Helps understand what the agent is actually doing without reading full output.

### Architectural Patterns to Adopt

9. **Agent definitions as .md files with frontmatter** — Simple, portable, readable.
   `name`, `description`, `tools` (whitelist), and system prompt body.

10. **Composable extensions via stacking** — Build small, single-purpose extensions.
    Stack them with `-e` flags. This is how we should think about our extensions too.

11. **`just` as extension orchestrator** — Named recipes for common extension combos.
    `just ext-tilldone`, `just all` to open everything in separate terminals.

## Quotes Worth Remembering

- "There are many coding agents, but this one is mine."
- "Every engineer is limited by the tools they use."
- "Knowing what your agent is doing is engineering. Not knowing is vibe coding."
- "You can't get ahead of the curve by doing what everyone else is doing."
- "Specialization doesn't stop at the model, agent, or orchestration level.
   You can customize your agentic coding tool."
- "Security in agentic coding is mostly theater."
- "One agent is not enough. You want to be stacking these."
- "Build whatever you want — but start with the foundational units."

---

*Transcript captured: 2026-03-05. Companion repo cloned to: /Users/cgn/git/dev/0xcgn/cool-projects/pi-vs-claude-code*
