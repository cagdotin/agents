# Conditional Feature Registration

Project-local reference for environment-dependent extension behavior.

Use this pattern when an extension should:

- detect environment once per session or reload
- activate runtime behavior only in matching environments
- expose skills or prompt templates only when relevant
- optionally add a cached system prompt hint and one-time activation message

Source implementation: `lib/extension-runtime/conditional-feature.ts`

---

## Why this exists

Pi always discovers extension entrypoints statically. This helper gives us a shared **conditional activation** layer inside the extension runtime so we do not have to hand-roll detection, activation, and `resources_discover` wiring in each extension.

This is the standard pattern for environment-sensitive features in this repo.

Examples:
- `extensions/cmux/` — active only inside cmux, exposes the cmux skill conditionally
- `extensions/qmd/` — activates when QMD is available, exposes the QMD skill only for indexed repos

---

## Core model

A conditional feature has three separate decisions:

1. **Detect state** — inspect the current environment or repo once
2. **Activate runtime** — decide whether commands, tools, footer state, panels, etc. should exist
3. **Expose agent-facing context** — decide whether skills, prompt templates, and prompt hints should be available

This separation matters.

For example, QMD may activate runtime support for `/qmd init` even when the repo is not indexed yet, while only exposing the QMD skill and indexed-repo prompt hint once the repo is actually bound to a collection.

---

## Helper API

```ts
import { register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";

register_conditional_feature(pi, {
  feature_name: "cmux",
  detect: () => ({
    inside_cmux: is_cmux(),
    has_cli: has_cmux_cli(),
    surface_id: process.env.CMUX_SURFACE_ID ?? "",
    skill_path: get_skill_path(),
  }),
  should_activate: (state) => state.inside_cmux && state.has_cli,
  activate: ({ ctx, state }) => {
    ctx.ui.setStatus("cmux", "⊞ cmux");
    register_notify(pi, state.surface_id);
    register_tab_title(pi, state.surface_id, ctx);
  },
  skill_paths: (state) => [state.skill_path],
  system_prompt_hint: "You are running inside cmux.",
  activation_message: {
    customType: "cmux-detected",
    content: "cmux detected — skill available, CLI ready",
  },
});
```

### Required fields

- `feature_name` — short identifier for logging/error context
- `detect(context)` — returns feature state
- `should_activate(state)` — runtime activation predicate

### Optional fields

- `activate(context)` — one-time runtime setup during `session_start`
- `should_include_skills(state)` — narrower gate for skill exposure
- `should_include_prompts(state)` — narrower gate for prompt-template exposure
- `skill_paths` — static array or state-based resolver
- `prompt_paths` — static array or state-based resolver
- `system_prompt_hint` — cached hint appended through `before_agent_start`
- `activation_message` — one-time visible custom message
- `on_detection_error(context)` — custom error handling for detector failures

---

## Lifecycle

### `session_start`

The helper:
- runs `detect({ cwd, reason: "startup" })`
- evaluates `should_activate(state)`
- runs `activate(...)` once when active
- caches the detected state

### `resources_discover`

The helper:
- reuses cached detection for the same `cwd + reason`
- returns `skillPaths` and `promptPaths` when allowed
- lets Pi rebuild the base system prompt with those resources loaded

### `before_agent_start`

Only used when the feature defines:
- `system_prompt_hint`
- and/or `activation_message`

The helper does **not** re-detect here. It only reads cached state and appends the already-decided hint. Activation messages are emitted once per runtime.

### `/reload`

Pi emits `resources_discover` with `reason: "reload"`. The helper treats reload as a fresh detection boundary.

---

## What belongs in `should_activate`

Put conditions here when they decide whether the feature runtime should exist at all.

Examples:
- cmux env + CLI availability
- toolchain present on disk
- repo has required config and the extension should be live

If `should_activate(state)` is false:
- `activate(...)` does not run
- `system_prompt_hint` does not apply
- `activation_message` does not emit
- default resource inclusion is also false

---

## What belongs in `should_include_*`

Use these when runtime activation is broader than model-facing exposure.

Example: QMD
- runtime active when QMD is available for this repo/session
- skill exposed only when repo binding is actually indexed
- indexed-repo hint exposed only when binding is indexed

Do **not** hide policy in the text builder if a separate predicate makes the code clearer.

---

## Error behavior

If `detect()` throws:
- the feature fails closed
- activation is skipped
- resources are not exposed
- optional `on_detection_error(...)` runs if provided

This prevents partially detected environments from exposing misleading skills or prompt hints.

---

## Current repo conventions

- Put shared runtime helpers in `lib/`, not `extensions/`
- Keep extension-owned skills under `extensions/<name>/skills/`
- Use `resources_discover` for conditional skill exposure
- Use cached prompt hints only for environment awareness, not for re-running detection
- Keep cross-extension runtime dependencies out of `extensions/`; share logic through `lib/`

---

## Related files

- `lib/extension-runtime/conditional-feature.ts`
- `extensions/cmux/index.ts`
- `extensions/qmd/index.ts`
- `docs/references/pi-api-reference.md`
- `docs/ARCHITECTURE.md`
