# Damage Control Extension

Default-on safety guardrails for YOLO-mode Pi sessions.

This extension intercepts tool calls before execution and enforces layered policy rules. It protects against destructive bash commands, access to sensitive files, mutation of read-only paths, and deletion of critical repository files. The goal is to preserve speed while removing catastrophic failure modes.

## Behavior

Damage Control loads rule files in this order:

1. bundled defaults (`extensions/damage-control/damage-control-rules.yaml`)
2. global user rules (`~/.pi/agent/damage-control-rules.yaml`)
3. nearest project rules discovered from `cwd` upward (`.pi/damage-control-rules.yaml`, walking to git root)

Rules are merged additively. Matching actions:

- `block`: tool call is denied immediately
- `ask`: user confirmation is required (if UI available)

When UI is unavailable, `ask` rules fail closed and block by default.

## Rule Model

Top-level YAML keys:

- `bash_tool_patterns`: regex-based command checks (`pattern`, `reason`, `action`)
- `zero_access_paths`: deny reads/writes/searches to sensitive paths
- `read_only_paths`: allow reads, deny mutations
- `no_delete_paths`: deny destructive delete/move operations

Path patterns support plain paths and simple globs (`*`, `**`, `?`).

## Observability

The footer shows a compact shield icon (`⛨`) under status key `damage-control`:

- green: healthy (no unread events)
- amber: unread policy activity
- red: unread blocking incident

The extension appends session log entries under custom type `damage-control-log` whenever a violation is blocked or confirmation is used.

Use `/damage-control` (alias: `/dc`) to open the runtime panel, or press `Ctrl+Alt+D` to toggle it. The panel shows active rule counts, loaded rule sources, and recent branch-local policy events.

Press `d` inside the panel to toggle damage control on or off. When disabled, the footer shield icon dims, a `⚠ DC OFF` banner appears in the status bar, and all tool calls pass through without policy checks. The toggle is session-scoped — damage control re-enables automatically on session start or switch.

## Usage Notes

This extension is discovered automatically through the package extension manifest and is intended to be always on. Customize behavior by adding global and/or project rule files; you usually should not edit bundled defaults directly.
