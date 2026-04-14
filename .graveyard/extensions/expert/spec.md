# Expert Extension — Rebuild Spec

Retired: 2026-04-03

## Purpose

Domain-scoped persistent expertise for Pi. Maintained per-domain YAML "mental models" in `.pi/expertise/` that gave agents quick orientation on specific codebase areas. Designed for high-value, hard-to-discover knowledge (why/gotchas), not for duplicating obvious implementation details.

## Reason for retirement

1. Auto-injection is the wrong retrieval model — dumps YAML into context without the agent choosing when/what to recall
2. Flat YAML doesn't compose — can't express relationships between insights or build a knowledge graph
3. Quality degraded over time — auto-appended insights ranged from useful to noise with no curation mechanism
4. Clearing the path for vault-based memory with atomic notes, MOC routing, and agent-driven retrieval

Detailed retirement analysis preserved in the original `RETIRED.md`.

---

## User-facing surface

### Tool: `expertise`

| Action   | Params | Description |
|----------|--------|-------------|
| `list`   | — | Show all domains with descriptions |
| `get`    | `domain` | Read a domain's full YAML |
| `init`   | `domain`, `scope_path`, `description?` | Bootstrap a new domain file from scope paths |
| `update` | `domain`, `content` | Replace full YAML content |
| `append` | `domain`, `section`, `content` | Add a single insight to a section |
| `delete` | `domain` | Remove a domain |

### Commands

- `/expert` or `/expert list` — list domains
- `/expert chat` — interactive domain picker (pin experts for current conversation)
- `/expert chat clear` — clear all pinned domains
- `/expert init <domain> <scope_path> [--description "..."]` — bootstrap a domain file

## Data model

### Storage

- Domain files: `.pi/expertise/<domain>.yaml`
- Settings: `.pi/expertise/settings.json`

### Domain YAML structure

```yaml
# Header metadata
scope:
  paths: ["src/auth/"]
  patterns: ["**/auth/**"]
related_domains: ["database", "api"]

# Content sections (agent-managed)
patterns:
  - "Auth middleware runs before route handlers"
gotchas:
  - "Session tokens must be rotated on password change"
design_decisions:
  - "Chose JWT over session cookies for stateless scaling"
```

### Settings

```json
{
  "max_context_percent_for_any_inject": 92
}
```

Above this context usage threshold, all injection (including pinned) is skipped.

## Lifecycle and injection

- `session_start` — load domain listing
- `before_agent_start` — inject compact domain listing (~10-20 tokens per domain) into system prompt. If domains are pinned, inject their full YAML content. Skip all injection above context threshold.
- Custom message renderer for showing pinned domain state
- Footer status tracking for pinned expertise count

## Key behaviors

- Domain name validation (lowercase, hyphens, no spaces)
- `append` parses and re-serializes entire YAML file (hand-edited formatting normalizes on first append)
- Pinned domains persist within a conversation but not across sessions
- `init` scans scope paths to auto-generate initial expertise structure

## Dependencies

- `@mariozechner/pi-coding-agent` — tool registration, commands, shortcuts, lifecycle hooks, context APIs
- `yaml` — YAML parsing and serialization for domain files
- `zod` — settings validation
- `@sinclair/typebox` / `StringEnum` — tool parameter schemas

## Related graveyard artifacts

- Expertise YAML files: `.graveyard/expertise/`
- Reflection log: `.graveyard/expertise/.reflections.log`
- Specs: `.graveyard/docs/specs/2026-03-06-r9-expert-extension-hardening.md`
- Specs: `.graveyard/docs/specs/2026-03-12-expert-extension-simplification.md`
- Exec plan: `.graveyard/docs/exec-plans/2026-03-12-expert-extension-simplification.md`
