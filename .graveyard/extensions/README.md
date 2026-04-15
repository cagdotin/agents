# Extension Graveyard

Retired extensions. Each folder contains a rebuild spec (`spec.md`) and reference summary (`references.md`) — no source code. See `.graveyard/PROCESS.md` for the full retirement process.

## expert

**Removed:** 2026-04-03

**What it did:** Auto-injected domain expertise (YAML files in `.pi/expertise/`) into agent context based on prompt matching. Used aliases, keywords, and pattern hints to route prompts to relevant domains, with context-budget-aware injection.

**Why it was retired:** The supply-driven YAML dump model is fundamentally wrong for agent memory. Flat YAML per domain can't express relationships, link insights, or build a knowledge graph. Direction is vault-based memory with atomic notes, MOC routing, and agent-driven retrieval.

## answer

**Removed:** 2026-04-04

**What it did:** LLM-powered Q&A extraction with a TUI component. Used a loader flow to extract structured answers from context.

**Why it was retired:** Low usage. The use case is better served by inline agent responses and skills.

## session-stats

**Removed:** 2026-04-04

**What it did:** In-session observability panel showing tool call charts, detail drill-downs, file timeline mode, model history, error counts, and session duration. Accessible via `Ctrl+Alt+T` or `/ss`.

**Why it was retired:** Session observability is a user-facing concern better served by a dedicated app. Ariadne covers all session-stats features plus cross-session analytics, cost/token tracking, and conversation replay.

## tmux

**Removed:** 2026-04-04

**What it did:** Unified tmux integration — desktop notifications on agent completion and dynamic pane title updates showing session/agent state.

**Why it was retired:** Replaced by the cmux extension, which provides the same notification behavior plus full cmux topology control, browser panels, and markdown viewers.

## autoresearch

**Removed:** 2026-03-28

**What it did:** Automated research pipeline that fetched, analyzed, and synthesized external content into resource documents.

**Why it was retired:** The research workflow moved to manual curation with vault-based storage. The automated pipeline produced volume but not enough quality.

## damage-control

**Removed:** 2026-03-20

**Reason:** Permission-gating the agent doesn't make practical sense. Even when tagging was mostly accurate, agents find workarounds for anything you try to ban. If access control is needed, the agent should run in an isolated environment instead — that's the only approach that actually holds.

## pi-json-render-ui (deleted)

**Removed:** 2026-04-02

**What it did:** Streamed json-render UIs into native Glimpse windows. When the user explicitly asked for visual output (dashboards, reports), the agent called a `render_ui` tool, opened a Glimpse window with a React/shadcn shell, and progressively rendered UI components from streamed YAML. Included a 36-component catalog and a companion skill under `skills/pi-json-render-ui/`.

**Why it was shelved:** The streaming pipeline worked in principle, but the end-to-end experience wasn't reliable enough to keep shipping. Upstream `@json-render/react` error boundaries permanently null-rendered components after transient streaming-time prop errors, several `@json-render/shadcn` components weren't tolerant of partial props during streaming, and the overall model ergonomics needed more iteration. May revisit when the json-render ecosystem matures or if Glimpse gets a simpler patching model.

## todos

**Removed:** 2026-04-14

**What it did:** File-based todo management with a `todo` tool for agent automation and an interactive `/todos` TUI for browsing, filtering, and acting on todos. Stored todos as YAML-frontmatter markdown files in `.pi/todos/` with per-session assignment/claiming and automatic garbage collection.

**Why it was retired:** Low usage over an extended period. The tracks extension covers task tracking for feature work more effectively with workstream-scoped contexts, deterministic sync, and local AGENTS.md. A full rebuild spec is in `todos/spec.md`.

## qmd-tui

**Removed:** 2026-04-15

**What it did:** Interactive split-pane TUI dashboard for the QMD index. Opened as a wide overlay panel (`/qmd`, `/qp`, `Ctrl+Alt+Q`) with a persistent collection sidebar and a context-sensitive main pane supporting overview, files, search, and preview views. Included NERDTree-style file browsing with index toggle, debounced search, and a plain-text fallback.

**Why it was retired:** The TUI panel added ~2,400 lines of UI code for a feature that was rarely used interactively. The remaining QMD extension (init pipeline, skill injection, prompt hints, freshness detection, footer status) covers the agent-facing workflow without a TUI.

## env-skills (deleted)

**Removed:** 2026-04-02

**What it did:** Detected the current project environment (React as proof of concept) and automatically injected matching skills from `.pi/env-skills/` directories into the agent's available skills. Provided `/env-skills` and `/env-skills rescan` commands for inspection.

**Why it was shelved:** The detection and injection worked, but the injected skills were only advertised through prompt XML — they didn't become real `/skill:name` commands. The gap between "visible in prompt" and "actually loadable" created confusion. The concept of environment-scoped skill filtering is worth revisiting once Pi's skill registration API supports dynamic additions at runtime.
