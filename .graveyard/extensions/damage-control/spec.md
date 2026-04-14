# Damage Control Extension — Rebuild Spec

Retired: 2026-03-20

## Purpose

Default-on safety guardrails for YOLO-mode Pi sessions. Intercepted tool calls before execution and enforced layered policy rules to protect against destructive bash commands, access to sensitive files, mutation of read-only paths, and deletion of critical repository files.

## Reason for retirement

Permission-gating the agent doesn't make practical sense. Even when tagging was mostly accurate, agents find workarounds for anything you try to ban. If access control is needed, the agent should run in an isolated environment — that's the only approach that actually holds.

---

## User-facing surface

- `/damage-control` (alias `/dc`) — open runtime panel
- `Ctrl+Alt+D` — toggle panel
- `d` inside panel — toggle damage control on/off (session-scoped, re-enables on session start)
- Footer shield icon (`⛨`): green = healthy, amber = unread activity, red = unread blocking incident, dim = disabled

## Rule model

### Rule sources (loaded in order, merged additively)

1. Bundled defaults (`extensions/damage-control/damage-control-rules.yaml`)
2. Global user rules (`~/.pi/agent/damage-control-rules.yaml`)
3. Nearest project rules discovered from `cwd` upward (`.pi/damage-control-rules.yaml`, walking to git root)

### Rule types (top-level YAML keys)

- `bash_tool_patterns` — regex-based command checks with `pattern`, `reason`, `action`
- `zero_access_paths` — deny all reads/writes/searches to sensitive paths
- `read_only_paths` — allow reads, deny mutations
- `no_delete_paths` — deny destructive delete/move operations

Path patterns support plain paths and simple globs (`*`, `**`, `?`).

### Actions

- `block` — tool call denied immediately
- `ask` — user confirmation required (if UI available; fails closed without UI)

## Policy evaluation

The `tool_call` hook evaluates each tool call against active rules:
1. Check if damage control is enabled (session-scoped toggle)
2. Run `evaluate_tool_call(event, cwd, active_rules)` which returns violation + confirmation flag
3. If `block`: deny with formatted reason, append log entry, update footer state
4. If `ask`: show confirmation dialog (30s timeout), log result either way
5. If no violation: pass through

## Observability

- Session log entries under custom type `damage-control-log` for each policy event
- Panel shows: active rule counts, loaded rule sources, recent branch-local policy events
- Non-UI fallback: prints plain-text summary

## Lifecycle

- `session_start` — load rules from all sources, reset UI state, show notification with rule summary
- `session_switch` — same as session_start
- `tool_call` — policy evaluation

## Key implementation details

- Rule loading: YAML parse with Zod validation, invalid rules counted and warned
- Log entries: `pi.appendEntry()` with custom type for session persistence
- Footer state machine: healthy → notify (on any event) → incident (on block)
- Panel uses `ctx.ui.custom()` with scrollable event list

## Dependencies

- `@mariozechner/pi-coding-agent` — `isToolCallEventType`, `ToolCallEvent`, Pi APIs
- `zod` — rule file validation
- `yaml` (or inline YAML parsing) — rule file loading
- Pi APIs: `pi.on("tool_call")`, `pi.registerCommand()`, `pi.registerShortcut()`, `pi.appendEntry()`, `ctx.ui.custom()`, `ctx.ui.confirm()`, `ctx.ui.setStatus()`, `ctx.ui.notify()`

## File structure at removal

- `index.ts` — entrypoint, hook wiring, confirmation flow, panel open/close
- `policy.ts` — `evaluate_tool_call()` against active rules
- `matcher.ts` — pattern matching, path glob expansion, truncation
- `rules-loader.ts` — multi-source YAML loading and merging
- `panel.ts` — TUI panel rendering
- `logs.ts` — log entry retrieval from session
- `constants.ts` — keys, icons, timeouts, instruction text
- `types.ts` — rule schemas, violation types, UI state
- `damage-control-rules.yaml` — bundled default rules
