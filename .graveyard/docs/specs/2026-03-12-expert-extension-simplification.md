# Expert Extension Simplification

Status: Draft
Date: 2026-03-12
Execution plan: [[docs/exec-plans/active/2026-03-12-expert-extension-simplification.md]]

## 1. Problem statement

The expert extension injects domain expertise YAML into the system prompt every turn via heuristic matching, and provides an LLM-driven reflection pipeline to update expertise files. This causes:

- **High context cost**: 1000-3000+ tokens injected per turn, plus ~400 tokens of CONTENT_PRINCIPLES in the tool description — always present regardless of relevance
- **High latency**: reflection triggers 1+N LLM calls (router + per-domain), each spawning a `pi -p` subprocess
- **Low signal-to-noise**: the reflection pipeline rewrites entire YAML files, often adding transient/obvious content that corrupts the long-lived mental model
- **Circular update cycle**: inject → work → reflect → rewrite YAML → inject updated YAML — rarely produces meaningful changes

The core concept (domain-scoped persistent context) is sound. The machinery around it is too heavy.

## 2. Goals and non-goals

### 2.1 Goals
- Remove the LLM-driven reflection pipeline entirely (router, reflection, reflection log)
- Remove auto-injection heuristics (no more keyword/alias/path scoring per turn)
- Provide lightweight domain awareness: agent sees domain names + descriptions (like skills), reads on demand
- Add a surgical `append` tool action for the agent to add individual insights without rewriting files
- Retain pinning for explicit user-controlled injection
- Reduce token overhead to near-zero for turns that don't need expertise
- Keep the extension functional for existing expertise YAML files (no migration needed)

### 2.2 Non-goals
- Changing the YAML file format (existing files continue to work)
- Building a new auto-injection mechanism (the whole point is to remove speculative injection)
- Adding new LLM-based features
- Changing the `/expert chat` pinning UX

## 3. System context

### Affected files

| File | Change |
|------|--------|
| `constants.ts` | Remove `REFLECTION_PROMPT`, `CONTENT_PRINCIPLES`, reflection-related constants |
| `types.ts` | Remove reflection/router types, add `append` action, remove `reflect` action, clean settings |
| `tool.ts` | Remove `reflect` case, add `append` case, slim down tool description |
| `hooks.ts` | Remove auto-injection matching, add lightweight domain listing to system prompt |
| `reflection.ts` | **Delete entirely** |
| `router.ts` | **Delete entirely** |
| `llm.ts` | **Delete entirely** |
| `helpers.ts` | Remove `match_domains_to_prompt`, `format_conversation_for_*`, `extract_modified_files`, `file_matches_scope` — keep `validate_domain_name`, `scan_scope_paths`, glob utilities |
| `storage.ts` | Remove reflection log functions, clean settings schema |
| `index.ts` | Remove `/expert reflect` and `/expert log` subcommands, remove reflection-related imports |
| `__tests__/reflection.test.ts` | **Delete entirely** |
| `__tests__/router.test.ts` | **Delete entirely** |
| `__tests__/helpers.test.ts` | Update to remove tests for deleted functions |
| `__tests__/storage.test.ts` | Update to remove reflection log tests |

### Integration points
- The `expertise` tool is registered with pi and referenced in system prompt templates
- Existing `.pi/expertise/*.yaml` files are consumed by the extension
- The `/expert` command is user-facing

## 4. Detailed design

### 4.1 Domain awareness (replaces auto-injection)

On `before_agent_start`, instead of matching + injecting full YAML:

1. List all domains (read headers only — already cached by `list_domains`)
2. Format as a compact listing in the system prompt:

```
# Domain Expertise

The following expertise files represent the agent's accumulated mental model of specific areas of this codebase.
Use the `expertise` tool with action `get` to read a domain when it's relevant to your task.

Available domains:
- database: PostgreSQL schema, migrations, and query patterns
- auth-flow: Authentication and authorization architecture
- extensions-dev: How to build pi extensions
```

3. Pinned domains still inject their full YAML (as today)
4. Cost: ~10-20 tokens per domain for the listing, versus 300-1000 tokens per injected domain

### 4.2 Tool actions (simplified)

| Action | Behavior |
|--------|----------|
| `list` | List all domains with descriptions (unchanged) |
| `get` | Read a domain's full YAML (unchanged) |
| `init` | Bootstrap a new domain (unchanged) |
| `update` | Replace full YAML content (unchanged) |
| `append` | **NEW**: Add a single insight to a specific section |
| `delete` | Remove a domain (unchanged) |

#### `append` action

Parameters:
- `domain` (required): target domain name
- `section` (required): YAML section to append to (e.g. `gotchas`, `design_decisions`, `patterns`, `references`)
- `content` (required): the insight to add (string)

Behavior:
1. Read existing YAML, parse it
2. Find the target section (must be an array/list)
3. Append the new content as a list item
4. Update `last_synced` timestamp
5. Write back

If the section doesn't exist, create it as a new list with the single item.

This is the replacement for the reflection pipeline — the agent decides when something is worth remembering and adds it directly. No LLM rewriting. No risk of dropping existing content.

### 4.3 Tool description

Strip `CONTENT_PRINCIPLES` from the tool description. Replace with a concise 2-3 sentence description:

```
Manage domain expertise files in .pi/expertise — the agent's persistent mental model of specific areas of the codebase. Actions: list (show all domains), get (read a domain's expertise), init (bootstrap new domain from scope paths), update (replace full YAML content), append (add a single insight to a section), delete (remove domain). After completing work that changes code in a domain's scope, use 'append' to record non-obvious insights worth remembering.
```

### 4.4 Commands (simplified)

| Command | Status |
|---------|--------|
| `/expert` or `/expert list` | Keep |
| `/expert chat` | Keep |
| `/expert chat clear` | Keep |
| `/expert reflect [domain]` | **Remove** |
| `/expert log [domain]` | **Remove** |
| `/expert init <domain> <scope_path>` | Keep |

### 4.5 Settings (simplified)

Remove `reflection_model` and `auto_inject` from settings (auto-inject is gone, reflection is gone).

Remaining settings:
```json
{
  "max_inject_domains": 5,
  "max_context_percent_for_auto_inject": 80,
  "max_context_percent_for_any_inject": 92
}
```

Note: `max_inject_domains` now only applies to pinned domains. The `max_context_percent_*` thresholds still apply to pinned injection.

### 4.6 Status bar and renderers

- Keep the pinned domains status (`📌 domain1, domain2`)
- Remove the auto-matched status (`🧠 domain3`)  
- Keep the expertise-loaded message renderer (now only shows pinned)
- Keep the expertise-skipped message renderer (context threshold)

## 5. Error handling

- `append` to a non-existent domain: return error "Domain 'X' not found. Use 'init' to create it."
- `append` to a non-list section: return error "Section 'X' is not a list. Use 'update' for full replacement."
- `append` with empty content: return error "content is required for append"

## 6. Testing strategy

### 6.1 Unit tests
- `append` action: appending to existing section, creating new section, error cases
- Storage: `append_to_section` helper function
- Verify deleted files don't break imports

### 6.2 Existing tests
- Delete `reflection.test.ts` and `router.test.ts`
- Update `helpers.test.ts` to remove tests for deleted matching/formatting functions
- Update `storage.test.ts` to remove reflection log tests

## 7. Implementation checklist

- [ ] Delete `reflection.ts`, `router.ts`, `llm.ts`
- [ ] Delete `__tests__/reflection.test.ts`, `__tests__/router.test.ts`
- [ ] Clean `constants.ts`: remove `REFLECTION_PROMPT`, `CONTENT_PRINCIPLES`, reflection log constants
- [ ] Clean `types.ts`: remove reflection/router types, update tool params (add `append`, remove `reflect`, add `section` param)
- [ ] Clean `helpers.ts`: remove matching/formatting functions, keep validation + scan + glob
- [ ] Clean `storage.ts`: remove reflection log functions, add `append_to_section`, clean settings
- [ ] Rewrite `hooks.ts`: replace auto-injection with lightweight domain listing, keep pinned injection
- [ ] Rewrite `tool.ts`: remove `reflect` case, add `append` case, slim tool description
- [ ] Rewrite `index.ts`: remove `/expert reflect`, `/expert log`, their parsers, reflection imports
- [ ] Update `__tests__/helpers.test.ts` and `__tests__/storage.test.ts`
- [ ] Add tests for `append` action
- [ ] Run `bun run check` and fix any issues
- [ ] Manual verification: start pi, check domain listing in prompt, test pinning, test append

## 8. Resolved questions

1. **`append` auto-updates `last_synced`** — yes, it's a modification event.
2. **Pinned domain count is uncapped** — user-explicit action, they know the cost.
3. **Domain listing in system prompt: name + description only** — no scope paths. Agent calls `get` for details.
