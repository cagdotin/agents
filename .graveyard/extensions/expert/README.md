# Expert Extension

Domain-scoped persistent expertise for Pi.

This extension maintains per-domain YAML "mental models" in `.pi/expertise/` that
give agents quick orientation on specific areas of a codebase.

## Core Idea

`AGENTS.md` is global and always loaded. Expertise is:

- **domain-scoped** (`database`, `auth-flow`, `extensions-dev`, ...)
- **on-demand** — a compact listing is injected; full YAML loads only when the agent calls `get` or the user pins a domain
- **surgically updated** — the agent appends individual insights without rewriting the whole file

## What It Adds

- `expertise` tool for CRUD + append operations
- `/expert` command for list/chat/init workflows
- lightweight domain listing injected into the system prompt each turn
- pinned domain injection (full YAML) via `/expert chat`
- custom message renderer showing pinned domains
- footer status tracking for pinned expertise

## Commands

- `/expert` or `/expert list` — list domains
- `/expert chat` — interactive domain picker (pin experts for current conversation)
- `/expert chat clear` — clear all pinned domains
- `/expert init <domain> <scope_path> [--description "..."]` — bootstrap a domain file

## Tool Actions

Tool: `expertise`

Actions:
- `list` — show all domains with descriptions
- `get` — read a domain's full YAML
- `init` — bootstrap a new domain from scope paths
- `update` — replace full YAML content
- `append` — add a single insight to a section (domain, section, and content required)
- `delete` — remove a domain

## Expertise Header Metadata

Domain YAML headers support:

- `scope.paths` — directory prefixes this domain covers
- `scope.patterns` — glob patterns (`*`, `**`, `?`) for matching files
- `related_domains` — hint-only related expertise names (shown in expanded pinned view)

## Settings

Optional file: `.pi/expertise/settings.json`

```json
{
  "max_context_percent_for_any_inject": 92
}
```

- `max_context_percent_for_any_inject` — above this context usage threshold, all injection (including pinned) is skipped

## Storage

- Expertise files: `.pi/expertise/<domain>.yaml`
- Settings: `.pi/expertise/settings.json`

## File Map

```
expert/
├── index.ts          # entrypoint, command registration, message renderers
├── hooks.ts          # lifecycle hooks, domain listing injection, pinned injection
├── tool.ts           # `expertise` tool implementation
├── storage.ts        # YAML/settings I/O, append_to_section
├── helpers.ts        # domain name validation, scope path scanning
├── constants.ts      # defaults, content principles
└── types.ts          # schema and type definitions
```

## Notes

- The domain listing costs ~10-20 tokens per domain. Full YAML only loads on `get` or pin.
- Expertise content is optimized for high-value, hard-to-discover knowledge (why/gotchas),
  not for duplicating obvious implementation details.
- `append` is the preferred way to add insights — it's safe (doesn't risk existing content)
  and updates `last_synced` automatically.

## Known Limitations

- **YAML roundtrip reformatting**: `append` parses and re-serializes the entire YAML file.
  Hand-edited formatting (comments, key order, whitespace) will be normalized on the first append.
  This is by design — expertise files are primarily agent-managed.
