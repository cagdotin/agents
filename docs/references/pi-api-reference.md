# Pi API Reference (Project-Focused)

> Purpose: quick reference for building and maintaining extensions/skills in **this repository**.  
> Source of truth: official Pi docs (`docs/extensions.md`, `docs/tui.md`, `docs/skills.md`, `docs/packages.md`) and examples.

## Canonical Upstream Docs

- Extensions API: `@mariozechner/pi-coding-agent/docs/extensions.md`
- TUI components: `@mariozechner/pi-coding-agent/docs/tui.md`
- Skills standard in Pi: `@mariozechner/pi-coding-agent/docs/skills.md`
- Pi packages manifest/distribution: `@mariozechner/pi-coding-agent/docs/packages.md`
- Example extensions: `@mariozechner/pi-coding-agent/examples/extensions/`

---

## 1) Extension Entry Pattern

In this repo, extensions should export a default function:

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function my_extension(pi: ExtensionAPI) {
  // register tools/commands/hooks/shortcuts here
}
```

Common structure used here:
- `index.ts` (entry)
- `tool.ts` (tool definitions)
- `command.ts` (slash commands)
- `hooks.ts` (event wiring)
- helper/types/constants files

All extensions under `extensions/` follow this structure.

---

## 2) High-Value APIs We Use Most

## 2.1 Registering tools

```ts
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "...",
  parameters: MyParams,
  async execute(tool_call_id, params, signal, on_update, ctx) {
    // ...
    return { content: [{ type: "text", text: "Done" }], details: {} };
  },
});
```

**Important signature order** in `execute`:  
`(toolCallId, params, signal, onUpdate, ctx)` — `ctx` is last.

**Enum parameters:** use `StringEnum` from `@mariozechner/pi-ai` for compatibility (especially Google APIs).

## 2.2 Registering commands and shortcuts

```ts
pi.registerCommand("mycmd", {
  description: "...",
  handler: async (args, ctx) => { /* ... */ },
});

pi.registerShortcut("ctrl+q", {
  description: "...",
  handler: async (ctx) => { /* ... */ },
});
```

## 2.3 Hooking events

Common events in this repo:
- session lifecycle: `session_start`, `session_switch`, `session_shutdown`
- agent lifecycle: `before_agent_start`, `agent_start`, `agent_end`
- tool flow: `tool_call`, `tool_result`
- input pipeline: `input`

Use hooks for guardrails/context injection; prefer tools/commands for explicit actions.

---

## 3) UI APIs (`ctx.ui`) Used in This Repo

- `notify(message, level)`
- `setStatus(key, text | undefined)`
- `setWidget(key, linesOrComponent, options?)`
- `setEditorText(text)`
- `custom((tui, theme, kb, done) => component, options?)`

Patterns:
- Use **one** `ctx.ui.custom()` root component and swap active child components.
- Use overlay mode (`{ overlay: true }`) for modal/popover behavior.
- Call `tui.requestRender()` after state changes.

TUI primitives we use:
- `Text`, `Container`, `Box`
- `SelectList`, `SettingsList`

---

## 4) Tool Rendering Contract

Tools can define:
- `renderCall(args, theme)`
- `renderResult(result, { expanded, isPartial }, theme)`

Project conventions:
- Collapsed view should be compact.
- Handle `isPartial` with a clear progress indicator.
- Add key hint to expand in collapsed mode where useful.
- Keep LLM `content[]` plain and machine-friendly; keep fancy formatting in renderer only.

---

## 5) State and Persistence

For extension state that should survive reload/session traversal:
- persist via tool result `details`, custom messages, or custom entries
- rebuild state on `session_start` from session entries

Examples in this repo:
- `extensions/todos` reconstructs from todo files and session context
- `extensions/expert` reconstructs active domain state from custom message entries

---

## 6) Packaging Rules for This Repo

`package.json` uses Pi manifest:

```json
"pi": {
  "skills": ["./skills"],
  "extensions": ["./extensions"],
  "themes": ["./pi-themes/"]
}
```

Only declare manifest paths that exist in-repo (add `prompts` later when real prompt templates are introduced).

For Pi core libs imported by extensions/skills, keep them in `peerDependencies` with `"*"`.

---

## 7) Practical Gotchas (Seen Here)

1. `StringEnum` > TypeBox union literals for string enums in tool schemas.
2. `DynamicBorder` color callback may need explicit `(s: string) => ...` typing.
3. `ctx.ui.custom()` blocks until `done()` is called.
4. `sendMessage(..., { triggerTurn: true })` is useful for extension-driven follow-up turns.
5. Use `setStatus()` for additive footer status; `setFooter()` replaces entire footer.

---

## 8) Quick “Where do I copy from?”

- Tool + command + TUI flow: `extensions/todos/`, `extensions/tracks/`
- LLM extraction flow with loader: `extensions/answer/`
- Multi-hook stateful extension + message renderer: `extensions/expert/`
- Panel + footer status: `extensions/damage-control/`, `extensions/session-stats/`
- Simple event-only extension: `extensions/tmux/notify.ts`

---

## 9) When Implementing New Pi Features

1. Read upstream docs first (`extensions.md` + `tui.md`).
2. Start from an existing local extension pattern.
3. Keep AGENTS guidance short; document behavior in extension README + this docs area.
4. Add/refresh quality notes in `docs/QUALITY.md` when introducing new capabilities.
