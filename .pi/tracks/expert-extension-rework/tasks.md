# Tasks

## Current milestone: Implementation

Spec: `docs/specs/2026-03-12-expert-extension-simplification.md`
Exec plan: `docs/exec-plans/active/2026-03-12-expert-extension-simplification.md`

### Implementation sequence

1. [ ] Delete dead code (reflection.ts, router.ts, llm.ts + their tests)
2. [ ] Clean constants.ts, types.ts, helpers.ts, storage.ts
3. [ ] Rewrite hooks.ts (lightweight listing replaces auto-injection)
4. [ ] Rewrite tool.ts (add append, remove reflect, slim description)
5. [ ] Rewrite index.ts (remove reflect/log commands)
6. [ ] Update remaining tests
7. [ ] End-to-end verification

## Future considerations

- Pruning story for append-only expertise files (not urgent — better than LLM rewrites corrupting content)
- Whether domain listing should include scope paths or just name + description
- Whether to add a `/expert read <domain>` command shortcut
