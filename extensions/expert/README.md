# Expert Extension

Self-improving domain expertise for Pi.

This extension maintains per-domain YAML "mental models" in `.pi/expertise/` and helps
agents load/update the right domain context at the right time.

## Core Idea

`AGENTS.md` is global and always loaded. Expertise is:

- **domain-scoped** (`database`, `auth-flow`, `extensions-dev`, ...)
- **selectively injected** per turn
- **explicitly maintained** through reflection

## What It Adds

- `expertise` tool for CRUD + reflection operations
- `/expert` command for list/chat/reflect workflows
- auto-injection hook before agent starts
- custom message renderer showing which domains were loaded
- footer status tracking for pinned/loaded expertise

## Commands

- `/expert` or `/expert list` — list domains
- `/expert chat` — interactive domain picker (pin experts for current conversation)
- `/expert chat clear` — clear all pinned domains
- `/expert reflect [domain]` — run reflection (single domain or router-based auto-routing)

## Tool Actions

Tool: `expertise`

Actions:
- `list`, `get`, `init`, `update`, `reflect`, `delete`

`reflect` behavior:
- with `domain`: direct single-domain reflection
- without `domain`: router determines affected domains, then runs domain reflections in parallel

## Settings

Optional file: `.pi/expertise/settings.json`

```json
{
  "auto_inject": true,
  "reflection_model": "",
  "max_inject_domains": 5
}
```

- `auto_inject` — inject matching domain expertise before each run
- `reflection_model` — override model used for routing/reflection (empty = current model)
- `max_inject_domains` — cap number of injected domains per turn

## Storage

- Expertise files: `.pi/expertise/<domain>.yaml`
- Reflection log: `.pi/expertise/.reflections.log`

## File Map

```
expert/
├── index.ts          # entrypoint, command/tool registration, renderer
├── hooks.ts          # lifecycle hooks + injection/status persistence
├── tool.ts           # `expertise` tool implementation
├── reflection.ts     # reflection pipeline orchestrator
├── router.ts         # affected-domain routing step
├── llm.ts            # in-process LLM calls
├── storage.ts        # YAML/settings/log I/O
├── helpers.ts        # matching/filtering/format helpers
├── constants.ts      # prompts/defaults/content principles
└── types.ts          # schema and type definitions
```

## Notes

- Reflection is **explicit-only** (no automatic reflection on every turn).
- Expertise content is optimized for high-value, hard-to-discover knowledge (why/gotchas),
  not for duplicating obvious implementation details.
