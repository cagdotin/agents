# Decisions

## Skill-first, not extension (2026-03-12)

**Decision:** Build a `browser` skill that teaches agents to use Lightpanda CLI
via bash. Do not build an extension yet.

**Rationale:**
- Agent already has bash — `lightpanda fetch --dump markdown` is one command
- Extension adds process management, tool registration, TUI rendering — none
  needed to get value from web browsing
- `youtube-transcript` skill proves the "CLI tool via skill" pattern works
- We should learn usage patterns from real work before over-engineering
- The MCP server mode (stateful browsing) isn't useful without MCP client
  support in the agent harness

**Tradeoffs accepted:**
- Agent must have the skill loaded to know about lightpanda (vs always-on tool)
- No structured params or TUI rendering (just raw bash output)
- No stateful multi-step browsing (each fetch is independent)
- Agent needs to remember CLI flags (mitigated by good SKILL.md)

**Revisit when:** MCP client support lands, multi-step browsing is needed,
or the skill feels limiting in practice.
