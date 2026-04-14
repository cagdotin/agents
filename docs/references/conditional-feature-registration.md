# Conditional feature registration

Project-local reference for `lib/extension-runtime/conditional-feature.ts`.

Use this helper when an extension wants to initialize a small local feature state once from `ExtensionContext`, then drive activation, conditional resource exposure, and optional instruction injection from that state.

This helper is a good fit when:
- a feature can decide enablement from one initialized state object
- runtime setup should happen at most once per extension runtime
- skills/prompts/instructions can be derived directly from that state

Use custom extension logic instead when a feature needs state refresh beyond extension-runtime replacement boundaries.

Source implementation: `lib/extension-runtime/conditional-feature.ts`

---

## Helper API

```ts
import { register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";

register_conditional_feature(pi, {
  init: (ctx) => detect_dependencies(ctx.cwd),
  activate: (ctx, state) => {
    if (!state.enabled) return;
    ctx.ui.setStatus("frontend-dev", "fe-dev");
  },
  get_skills: (state) => get_skills(state),
});

register_conditional_feature(pi, {
  init: () => ({ enabled: is_cmux() && has_cmux_cli() }),
  activate: (ctx, _state) => {
    ctx.ui.setStatus("cmux", "⊞ cmux");
  },
  get_skills: () => [get_skill_path()],
  get_instructions: () => "You are running inside cmux.",
});
```

## State contract

`init(ctx)` must return an object with:
- `enabled: boolean`

The helper also tracks one-time activation on the state object during runtime. Treat the initialized state as helper-owned runtime state, not as immutable input.

## Config fields

### Required

- `init(ctx)` — synchronously initialize feature state from `ExtensionContext`
- `activate(ctx, state)` — runtime setup hook called during `session_start` when `state.enabled` is true and the feature has not already activated in this runtime

### Optional

- `get_skills(state)` — return skill paths for `resources_discover`
- `get_prompts(state)` — return prompt-template paths for `resources_discover`
- `get_instructions(state)` — return extra system-prompt text for `before_agent_start`; the helper trims whitespace and skips blank results

---

## Lifecycle model

### Within one extension runtime

The helper:
- lazily initializes state on first use
- reuses that same state for later hooks
- activates at most once while that extension runtime stays alive

### Across Pi session replacement flows

Upstream Pi lifecycle docs say `/new`, `/resume`, `/fork`, and `/reload` all emit `session_shutdown` for the old extension instance, then reload and rebind extensions before the next `session_start`.

That means one-time helper state is safe across those boundaries: a new extension runtime gets a fresh call to `init(ctx)`.

### Within-session events

Events such as `session_tree` and `session_compact` do not replace the extension runtime. If a feature needs recomputation during those events, do not rely on this helper alone.

---

## Error behavior

The helper is fail-loud.

- It does not catch synchronous `init(ctx)` errors.
- It does not catch synchronous `activate(ctx, state)` errors.
- It does not provide retries, snapshots, or recovery.
- Async `init`/`activate` behavior is outside the current contract; keep both hooks synchronous.

---

## Current repo conventions

- Put shared runtime helpers in `lib/`, not `extensions/`
- Keep extension-owned skills under `extensions/<name>/skills/`
- Use `resources_discover` for conditional skill exposure
- Prefer this helper when one-time initialized state is enough
- Use custom runtime logic for richer refresh behavior

---

## Related files

- `lib/extension-runtime/conditional-feature.ts`
- `lib/extension-runtime/__tests__/conditional-feature.test.ts`
- `extensions/cmux/index.ts`
- `extensions/frontend-dev/index.ts`
- `docs/references/pi-api-reference.md`
- `docs/ARCHITECTURE.md`
