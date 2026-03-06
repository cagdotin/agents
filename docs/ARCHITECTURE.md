# ARCHITECTURE

Status: active  
Last updated: 2026-03-06

## 1) Purpose

This repository is a **Pi package** that centralizes reusable agent capabilities:

- **Extensions** (TypeScript runtime integrations for Pi)
- **Skills** (agent-invoked procedural playbooks)
- **Themes** (Pi UI themes)
- **Resource docs** (curated external references for agentic coding practices)

`AGENTS.md` is intentionally short and acts as an entrypoint. This document is the deeper system map.

---

## 2) Top-Level Domains

## 2.1 Extensions (`extensions/`)

Pi runtime code that can register tools, commands, hooks, and TUI components.

Current extensions:
- `answer/` — extract questions from assistant output and collect structured answers
- `todos/` — file-based todo system (`.pi/todos`) + tool + `/todos` TUI command
- `expert/` — domain expertise memory system (`.pi/expertise`) + tool + `/expert`
- `tmux-notify/` — tmux window badge + sound when agent finishes long tasks
- `tmux-pane-title/` — tmux pane title/status integration for multi-session awareness

Design intent:
- Keep extension logic in-repo and versioned
- Prefer explicit, inspectable workflows over hidden behavior
- Use custom tools for repeatable capability surfaces

## 2.2 Skills (`skills/`)

Task-specific instruction bundles (`SKILL.md`) loaded on-demand by the agent.

Current skills include:
- `commit`
- `create-spec`
- `github`
- `linear`
- `pr-review`
- `youtube-transcript`

Design intent:
- Progressive disclosure: short metadata always available, full instructions loaded only when needed
- Keep workflows executable and copyable by agents

## 2.3 Themes (`pi-themes/`)

Pi theme JSON files distributed with this package.

## 2.4 Documentation (`docs/`)

- `ARCHITECTURE.md` — repository map and boundaries
- `QUALITY.md` — quality scorecard and prioritized gaps
- `exec-plans/` — active/completed execution plans and tech debt tracker
- `references/` — in-repo quick references (e.g., Pi API reference)
- `resources/` — external videos/articles/resources captured with structured frontmatter

Design intent:
- Treat repository docs as system-of-record context for both humans and agents
- Prefer discoverable markdown artifacts over chat-only decisions

---

## 3) Runtime Data Boundaries

These are generated/used at runtime and are intentionally separated from source code:

- `.pi/todos/` — todo markdown files managed by `extensions/todos`
- `.pi/expertise/` — expertise domain YAML files managed by `extensions/expert`

Repository source defines behavior; runtime state lives under `.pi/`.

---

## 4) Packaging and Loading

`package.json` declares this repository as a Pi package via the `pi` manifest:

- prompts: `./commands` (reserved path; currently no prompt templates checked in)
- skills: `./skills`
- extensions: `./extensions`
- themes: `./pi-themes/`

Pi discovers and loads these resources from this package when installed globally or per-project.

---

## 5) Architectural Principles for This Repo

1. **AGENTS.md is a map, not an encyclopedia**
   - Keep global instructions short.
   - Put detailed guidance in targeted docs and skill files.

2. **Progressive disclosure**
   - Start from architecture/quality docs.
   - Drill into extension READMEs, then source files.

3. **Mechanizable conventions over tribal knowledge**
   - Capture workflows in skills and extension tools.
   - Keep docs structured and frontmatter-driven where possible.

4. **Single package-manager policy (Bun)**
   - Use Bun for dependency management and script execution.
   - Avoid mixed npm/yarn/pnpm command usage in repo docs/workflows.

5. **Agent legibility first**
   - Important decisions should be represented in repo files.
   - Avoid relying on ephemeral chat context.

---

## 6) Implementation Patterns to Reuse

- Full tool + command + TUI pattern: `extensions/todos/`
- LLM extraction and model-selection pattern: `extensions/answer/extraction.ts`
- Domain memory + reflection pipeline pattern: `extensions/expert/`

When adding new extensions, prefer matching these patterns unless there is a strong reason to diverge.

## 7) Quality Gates Contract

Local quality checks are centralized in Bun scripts and reused by hooks/CI:

- `bun run check:biome` → Biome repository checks
- `bun run check:docs` → `scripts/validate-docs.ts` frontmatter/README validation
- `bun run check` → aggregate contract used by Lefthook pre-commit

`lefthook.yml` intentionally invokes only `bun run check` so validation logic stays in one place.
