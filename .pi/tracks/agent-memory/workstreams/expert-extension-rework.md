# Workstream: expert-extension-rework (merged)

Source track: `.pi/tracks/expert-extension-rework/` (merged into `agent-memory`)

## Status

- Simplification implementation is complete.
- Reflection pipeline and auto-injection heuristics were removed.
- Expertise now uses lightweight listing + on-demand reads + surgical `append` updates.

## Kept findings

- Previous model could add 1500-3000+ tokens/turn from speculative injection.
- Reflection pipeline cost scaled as 1+N LLM calls and had low signal.
- Regex-based XML extraction in reflection/router paths was fragile.

## Kept decisions

- Kill reflection instead of optimizing it.
- Replace auto-injection with skills-like awareness listing.
- Keep explicit pinned injection as user-controlled context.
- Strip large always-on guidance blocks from tool description.
- Keep append-first updates for stable long-lived knowledge.

## Follow-up ideas carried into agent-memory

- Define pruning/compaction strategy for long-lived append-only expertise files.
- Evaluate whether to add `/expert read <domain>` as a command shortcut.
- Keep expertise thin and navigational while relying on QMD for deep retrieval.

## References

- `docs/specs/2026-03-12-expert-extension-simplification.md`
- `docs/exec-plans/active/2026-03-12-expert-extension-simplification.md`
- `extensions/expert/README.md`
- `.pi/expertise/`
