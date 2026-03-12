# Expert Extension — Current Behavior Documentation

## What It Does (High Level)

The expert extension maintains per-domain YAML "mental model" files in `.pi/expertise/`.
It has three main jobs:

1. **Inject** relevant expertise into the system prompt before each agent turn
2. **Reflect** — run LLM calls to update expertise YAML based on conversation content
3. **UI** — commands, status bar, custom message renderers

## Architecture (10 files)

```
extensions/expert/
├── index.ts       — entrypoint: command registration, tool registration, renderers
├── hooks.ts       — lifecycle hooks + injection logic (the hot path)
├── tool.ts        — `expertise` tool (list/get/init/update/reflect/delete)
├── reflection.ts  — reflection pipeline orchestrator
├── router.ts      — router step: LLM call to identify affected domains
├── llm.ts         — in-process LLM completion helper
├── storage.ts     — YAML/settings/log file I/O
├── helpers.ts     — matching heuristics, conversation formatting, glob support
├── constants.ts   — prompts, defaults, content principles
└── types.ts       — TypeBox schemas and type definitions
```

## The Injection Path (every turn)

On `before_agent_start`:

1. Read `settings.json` from expertise dir (defaults: auto_inject=true, max 5 domains)
2. Check context usage — if above 92%, skip all injection; if above 80%, skip auto-inject (only pinned)
3. **Pinned domains**: always loaded (user-selected via `/expert chat`)
4. **Auto-matched domains**: `match_domains_to_prompt()` scores every domain against the user's prompt using:
   - Domain name substring match (+10)
   - Alias matches (+8 each)
   - Scope path matches (+8 each)
   - Scope pattern basename hint matches (+6 each)
   - Keyword matches (+4 each)
   - Description word overlap (+2 each)
   - Threshold: score ≥ 6 to qualify
5. Sorted by score, capped at `max_inject_domains` (default 5)
6. Each matched domain's full YAML is read and wrapped in `<expertise domain="...">` XML
7. All blocks concatenated and appended to the system prompt with a "Domain Expertise" header
8. A "consider reflecting" nudge is appended at the end

### Context cost per turn:
- The injection header/footer: ~200 tokens
- Each domain YAML: typically 40-120 lines → 300-1000 tokens each
- The tool description includes `CONTENT_PRINCIPLES` (~400 tokens) — always present in tool list
- Total: easily 1000-3000 tokens added to every turn even with one domain

## The Reflection Path (explicit trigger)

Triggered by `/expert reflect` command or `expertise reflect` tool call.

### Without a target domain (full pipeline):
1. **Router step** — an LLM call that receives:
   - All domain descriptions + scope paths
   - Condensed conversation (user messages + summarized assistant, no tool output)
   - Returns XML listing affected domains with 2-5 bullet points each
2. **Per-domain reflection** — parallel LLM calls, each receives:
   - The full REFLECTION_PROMPT (~800 tokens of system prompt)
   - Current domain YAML + router attention points + full conversation (filtered to domain scope)
   - Returns `<updated_expertise>` YAML + `<reflection_summary>`
3. Updated YAML written to disk, log entry appended

### With a target domain:
- Skips router, goes straight to reflection LLM call

### Cost per reflection:
- Router: 1 LLM call (conversation + all domain headers)
- Per-domain: 1 LLM call each (conversation + current YAML)
- For N affected domains: 1 + N LLM calls
- Wall-clock time: noticeable — seconds per call

## The Tool (`expertise`)

Registered as a tool the agent can call. Actions:

- **list**: enumerate domains
- **get**: read a domain's YAML
- **init**: create skeleton YAML + scan scope files
- **update**: overwrite domain YAML directly
- **reflect**: trigger the reflection pipeline
- **delete**: remove a domain

The tool description includes the full `CONTENT_PRINCIPLES` text (~400 tokens), which is
always present in the tool listing for every conversation, regardless of whether expertise
is relevant.

## Commands (`/expert`)

- `/expert` or `/expert list` — list domains
- `/expert chat` — interactive domain picker (pin/unpin for session)
- `/expert chat clear` — clear pins
- `/expert reflect [domain]` — run reflection
- `/expert log [domain] [--limit N]` — show reflection history
- `/expert init <domain> <scope_path> [--description "..."]` — bootstrap domain

## Session State

- Pinned domains: persisted via `appendEntry` (survives branch navigation)
- Session domains: rebuilt from custom messages on session lifecycle events
- Status bar: shows pinned (📌) and auto-loaded (🧠) domains

## Settings (`.pi/expertise/settings.json`)

```json
{
  "auto_inject": true,
  "reflection_model": "",
  "max_inject_domains": 5,
  "max_context_percent_for_auto_inject": 80,
  "max_context_percent_for_any_inject": 92
}
```

---

## Known Issues / Concerns

### 1. High context overhead
- Expertise YAML injected into system prompt every turn
- Tool description includes ~400 tokens of CONTENT_PRINCIPLES always
- Even modest domains add 1000+ tokens per turn
- With multiple auto-matched domains, can easily consume 3000+ tokens

### 2. Reflection is expensive and questionable value
- Each reflection triggers 1+ LLM calls (router + per-domain)
- The updated YAML rarely captures meaningfully new insights turn-by-turn
- The "nudge to reflect" at end of injection encourages frequent reflection
- Router XML parsing is regex-based and fragile if model output drifts

### 3. Auto-matching is heuristic and noisy
- Keyword/alias/path scoring can inject irrelevant domains
- Missing metadata (keywords, aliases) causes false negatives
- No user feedback loop — can't tell the system "this domain was wrong"

### 4. The update cycle is circular
- Agent reads expertise → does work → reflects → updates expertise → next turn reads updated expertise
- For most conversations, the expertise doesn't meaningfully change
- The cycle adds latency and context without proportional value

### 5. Session overhead
- Rebuilds in-memory state from branch on 5 different lifecycle events
- Custom message types for injection tracking add entries to session

### 6. The "mental model" concept is sound but execution is heavy
- The idea of domain-scoped context that loads selectively is good
- But the current implementation treats it as a continuously-updated living document
- Most of the value comes from the initial expertise write, not ongoing reflection
