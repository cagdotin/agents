# Report

## Current status (2026-03-12)

Exploration complete. Decision made: skill-first approach.

**Done:**
- Downloaded and tested Lightpanda binary (macOS arm64 nightly)
- Verified all three modes: `fetch` CLI, `mcp` server, `serve` CDP
- Tested against real sites: Wikipedia, HN, Anthropic docs, lightpanda.io
- Wrote integration spec: `docs/specs/lightpanda-browser-integration.md`
- Documented decision rationale and future escalation triggers

**Next:**
- Build the `skills/browser/` skill (SKILL.md + setup script)
- Test the skill in real agent workflows

## Open risks

- Lightpanda is beta — some sites will fail. Skill should mention this.
- Binary is nightly-only (no stable releases yet). Updates may break things.
- Large pages may blow context. Need guidance on truncation.
