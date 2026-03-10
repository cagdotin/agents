# ARCHITECTURE

Status: active
Last updated: 2026-03-10

---

## Bird's Eye

This repository is a **Pi package** — a distribution unit that gives coding agents
reusable capabilities. It solves one problem: keeping agent extensions, skills, themes,
and the documentation that governs them versioned, discoverable, and mechanically
validated in a single place.

Pi discovers these resources through the `pi` manifest in `package.json`.

---

## Codemap

### `extensions/`

Pi runtime code: tools, commands, hooks, and TUI components loaded at startup.
Each subdirectory is a self-contained extension with its own README.

Key extensions to know by name:

- `todos` — File-based todo system. Full tool + command + TUI pattern.
  **Gold-standard reference** for new extension development.
- `expert` — Domain expertise memory (`.pi/expertise/` YAML files).
  Reflection pipeline, context-budget-aware injection, slash command.
- `damage-control` — Default-on safety guardrails for YOLO mode. Layered
  rule engine (bundled + global + project), policy panel, and session logging.
- `session-stats` — In-session observability panel. Tool call bar charts,
  per-tool detail drill-downs, file timeline mode, model history.
- `answer` — LLM extraction of questions from assistant output,
  structured answer collection. Model-selection pattern lives here.
- `tmux-notify` and `tmux-pane-title` — Lightweight tmux integrations
  (badge/sound, pane status). Minimal but documented.

### `skills/`

Task-specific instruction bundles. Each skill is a directory with a `SKILL.md`
loaded on demand by the agent when the task matches. Skills are declarative
playbooks, not runtime code.

### `pi-themes/`

Theme JSON files distributed with this package. Pure data, no logic.

### `docs/`

System-of-record knowledge base for humans and agents.

- `ARCHITECTURE.md` — this file (repository map and invariants)
- `QUALITY.md` — quality scorecard and prioritized gaps
- `CONTRIBUTING-DOCS.md` — rules for documentation contributions
- `exec-plans/` — active/completed execution plans + `tech-debt-tracker.md`
- `specs/` — implementation specs for planned or complex work
- `references/` — internal quick references (e.g., Pi API reference)
- `resources/` — curated external resources with structured frontmatter

### `scripts/`

Validation and automation scripts invoked by `bun run` commands.
`validate-docs.ts` checks frontmatter and README presence.

### `.pi/`

Runtime state — **not source code**. Generated and managed by extensions:

- `.pi/todos/` — todo markdown files (managed by `extensions/todos`)
- `.pi/expertise/` — expertise YAML files (managed by `extensions/expert`)

---

## Boundaries

### Source vs. Runtime

Repository source (`extensions/`, `skills/`, `docs/`) defines behavior.
Runtime state (`.pi/`) is generated, ephemeral, and gitignored.
Extensions must never write into source directories at runtime.

### Extensions vs. Skills

Extensions are **runtime code** — they register tools, hooks, and UI components
that execute during the agent session. Skills are **static instructions** — markdown
playbooks loaded into agent context on demand. An extension can invoke a skill's
content, but a skill cannot execute extension code.

### Docs vs. Code

`docs/` is the system of record for decisions, architecture, and quality posture.
It is not auto-generated from code. Code is the source of truth for behavior;
docs are the source of truth for *why* and *where*.

---

## Invariants

These are intentional constraints. If you find yourself violating one, stop and
reconsider — or update this section with the reasoning for the change.

1. **AGENTS.md is a map, not an encyclopedia.**
   It stays under ~50 lines of real content. Detailed guidance lives in `docs/`
   and extension READMEs. (See: [[harness-engineering-openai]])

2. **No cross-extension runtime dependencies.**
   Extensions do not import from each other. Shared patterns are duplicated or
   extracted to a shared utility only when three or more extensions need them.

3. **Single package manager: Bun.**
   All scripts, install commands, and doc examples use `bun` / `bun run` / `bunx`.
   No npm, yarn, or pnpm.

4. **Extensions require no build step.**
   Pi loads TypeScript directly. There is no compile/bundle phase.
   If an extension needs a dependency, it goes in the package-level `package.json`.

5. **Every extension directory has a README.**
   Including small/simple ones. Behavior, requirements, and usage must be
   discoverable without reading the source.

6. **Expertise files are working memory, not source of truth.**
   `.pi/expertise/` YAML is a mental model — a cache of hard-won understanding.
   The code is always authoritative. Expertise can be stale; code cannot.

7. **Docs stay honest about what's not there.**
   Quality gaps are tracked in `QUALITY.md`, not hidden. Planned work lives in
   `exec-plans/` or `specs/`, not in aspirational doc prose.

---

## Cross-Cutting Concerns

### Agent Legibility

All important decisions must be represented in repo files. If it's not in the repo,
it doesn't exist from the agent's perspective. Avoid relying on chat history,
external docs, or tribal knowledge.

### Progressive Disclosure

Navigation follows a drill-down pattern:
`AGENTS.md` → `docs/ARCHITECTURE.md` → domain docs → extension READMEs → source.
Each layer should be self-contained enough to stop reading when you have what you need.

### Mechanical Validation

Conventions are enforced by tooling, not discipline:
- `bun run check:biome` — code style (Biome)
- `bun run check:docs` — frontmatter and README validation
- `bun run check` — aggregate gate used by Lefthook pre-commit

### Naming Conventions

- Files and directories: `kebab-case`
- Functions and variables: `snake_case`
- Types and classes: `CamelCase`

These are enforced project-wide, including in docs examples.

### Extension Patterns

When building new extensions, match the patterns in `todos` unless there is a strong
reason to diverge. Key patterns: tool + command + TUI surface, compact collapsed
rendering, separate agent-facing vs. human-facing output, `StringEnum` for action
parameters. Validation stack convention: TypeBox + `StringEnum` at Pi tool interfaces,
Zod at runtime data boundaries (files/frontmatter/YAML/JSON/LLM output).

---

## Packaging

`package.json` declares this repo as a Pi package via its `pi` manifest field:

- `skills` → `./skills`
- `extensions` → `./extensions`
- `themes` → `./pi-themes/`

Pi discovers and loads these when the package is installed globally or per-project.
