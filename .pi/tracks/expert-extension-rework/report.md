# Report

## Status: Plan complete, ready for implementation

### What happened

Analyzed the full expert extension codebase (10 files, ~1500 lines) and documented:
- Current behavior in detail (`current-behavior.md`)
- Root causes of the three main complaints (context overhead, latency, low-value reflection)
- Quantified the context cost (~1500-3000+ tokens per turn)

### What was decided

1. Kill the LLM reflection pipeline entirely (router + per-domain reflection + reflection log)
2. Replace auto-injection with a lightweight skills-like domain listing (~10-20 tokens per domain)
3. Add a surgical `append` tool action for the agent to add individual insights
4. Keep pinned injection (user-explicit, intentional cost)
5. Strip bloated `CONTENT_PRINCIPLES` from tool description

### Artifacts produced

- Spec: `docs/specs/2026-03-12-expert-extension-simplification.md`
- Execution plan: `docs/exec-plans/active/2026-03-12-expert-extension-simplification.md`
- Current behavior doc: `.pi/tracks/expert-extension-rework/current-behavior.md`

### What's next

Implementation — 7 milestones, starting with deleting dead code and ending with e2e verification. Any session can pick this up from the exec plan.

### Open risks

- Need to update the extension README after implementation
- Existing system prompt templates that reference `expertise reflect` will need updating
- The `append`-only model has no pruning story yet (acceptable tradeoff for now)
