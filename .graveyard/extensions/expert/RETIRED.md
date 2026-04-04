# expert extension — retired 2026-04-04

## What it did

Managed per-domain "mental models" as YAML files in `.pi/expertise/`. Provided:
- `expertise` tool (list, get, init, update, append, delete actions)
- Lightweight domain listing injected into system prompt (~10-20 tokens per domain)
- `/expert chat` command for user-driven pinning of full YAML into context
- Session hooks for auto-injection of pinned domains

## Why it was retired

### 1. Auto-injection is the wrong retrieval model
The extension dumps YAML blobs into context — either always (listing) or via pinning (full content). The agent doesn't choose *when* or *what* to recall based on the task at hand. Good memory is demand-driven retrieval, not supply-driven injection.

### 2. Flat YAML doesn't compose
Each domain is a single YAML file with predefined sections (patterns, gotchas, design_decisions). This structure can't express relationships between insights, link across domains, or build a knowledge graph. It's a flat bag of facts with no topology.

### 3. Results weren't good enough
The quality of accumulated expertise was inconsistent. Auto-appended insights ranged from genuinely useful to noise. Without a way to curate, link, or weight claims, the signal-to-noise ratio degraded over time.

### 4. Clearing the path for vault-based memory
The long-term direction is a per-repo vault with a graph/folder structure (similar to `/Users/cgn/git/dev/0xcgn/vault`) where domain expertise becomes a MOC (Map of Content) routing to atomic notes with specific claims. This requires:
- Atomic, linkable notes instead of monolithic YAML
- Explicit claim structure (claim → evidence → confidence)
- Agent-driven retrieval (search/navigate) instead of auto-injection
- Composability across repos via vault conventions

Retiring the current system now creates a clean baseline for measuring what the replacement needs to do better.

## What was preserved

- Extension source: `.graveyard/extensions/expert/`
- Expertise YAML files: `.graveyard/expertise/`
- Reflection log: `.graveyard/expertise/.reflections.log`
- Specs: `.graveyard/docs/specs/2026-03-06-r9-expert-extension-hardening.md`
- Specs: `.graveyard/docs/specs/2026-03-12-expert-extension-simplification.md`
- Exec plan: `.graveyard/docs/exec-plans/2026-03-12-expert-extension-simplification.md`
