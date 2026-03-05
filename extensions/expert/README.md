# Expert Extension

Self-improving domain expertise for pi. Agents that learn from conversations and accumulate knowledge about specific areas of your codebase.

## Concept

An **Agent Expert** maintains a "mental model" — a YAML file per domain (e.g. `database`, `auth`, `websocket`) that captures files, architecture, patterns, and gotchas. Unlike `AGENTS.md` which is always loaded, expertise is:

- **Per-domain** — one file per area of your codebase
- **Selectively injected** — only loaded when relevant to the current task
- **Self-improving** — updated from conversation insights, not just code diffs

## Quick Start

1. Ask the agent to initialize a domain:
   ```
   Initialize an expertise domain called "database" covering src/db/
   ```

2. Work normally. The agent reads relevant expertise before acting and updates it after.

3. Manually trigger reflection anytime:
   ```
   /expert reflect database
   ```

## How It Works

### Auto-Injection (`before_agent_start`)
When you send a message, the extension matches your prompt against domain names, descriptions, and scope paths. Matching expertise is injected into the system prompt so the agent already "knows" the domain.

### Auto-Reflection (`agent_end`)
After the agent finishes work that modified files in a domain's scope, a **cheaper model** (configurable) reviews the **entire conversation** — not just the diff — and extracts:
- Corrections you made ("we don't do it that way")
- Architectural decisions and their reasoning
- Patterns and conventions
- Gotchas and edge cases

### Manual Reflection (`/expert reflect`)
Trigger reflection anytime — useful after committing changes (when diffs are gone) or after a long discussion.

## Expertise File Format

Stored in `.pi/expertise/<domain>.yaml`:

```yaml
domain: database
description: "Database schema, migrations, and query patterns"
last_synced: "2026-03-05T12:31:00Z"

scope:
  paths:
    - src/db/
    - prisma/

# Everything below is agent-maintained
files:
  - path: src/db/schema.ts
    purpose: "Drizzle ORM schema definitions"

architecture:
  - "users → posts (one-to-many via user_id)"

patterns:
  - "All queries go through the repository layer"

gotchas:
  - "Always filter deleted_at IS NULL for user queries"
```

## Tool Actions

The `expertise` tool is available to the LLM with these actions:

| Action | Description |
|--------|-------------|
| `list` | List all domains with descriptions |
| `get` | Read a domain's full expertise |
| `init` | Bootstrap a new domain from scope paths |
| `update` | Replace full YAML content |
| `reflect` | Extract insights from conversation and update |
| `delete` | Remove a domain |

## Commands

| Command | Description |
|---------|-------------|
| `/expert` | List all expertise domains |
| `/expert list` | Same as above |
| `/expert reflect [domain]` | Trigger manual reflection |

## Settings

Create `.pi/expertise/settings.json`:

```json
{
  "auto_inject": true,
  "auto_improve": true,
  "reflection_model": "anthropic/claude-3-5-haiku",
  "max_inject_domains": 2
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `auto_inject` | `true` | Inject matching expertise into system prompt |
| `auto_improve` | `true` | Auto-reflect after modifying files in a domain's scope |
| `reflection_model` | `""` (current model) | Model for reflection — use a cheap/fast one |
| `max_inject_domains` | `2` | Max domains to inject per turn |

## Reflection Log

Every reflection is logged to `.pi/expertise/.reflections.log` with:
- Date, domain, session path, model used
- Summary of what changed and why

## Files

```
extensions/expert/
├── index.ts          # Entry point
├── types.ts          # TypeScript types & tool params
├── constants.ts      # Paths, defaults, reflection prompt
├── storage.ts        # YAML read/write, settings, reflection log
├── helpers.ts        # Domain matching, file scanning
├── tool.ts           # The expertise tool (6 actions)
├── reflection.ts     # Reflection engine (cheap model call)
└── hooks.ts          # Event hooks (injection + auto-reflect)
```
