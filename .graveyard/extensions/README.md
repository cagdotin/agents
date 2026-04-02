# Extension Graveyard

Retired extensions kept for reference. Moved here instead of deleted so we remember what was tried.
Extensions below marked **(deleted)** were removed without preserving code.

## damage-control

**Removed:** 2026-03-20

**Reason:** Permission-gating the agent doesn't make practical sense. Even when tagging was mostly accurate, agents find workarounds for anything you try to ban. If access control is needed, the agent should run in an isolated environment instead — that's the only approach that actually holds.

## pi-json-render-ui (deleted)

**Removed:** 2026-04-02

**What it did:** Streamed json-render UIs into native Glimpse windows. When the user explicitly asked for visual output (dashboards, reports), the agent called a `render_ui` tool, opened a Glimpse window with a React/shadcn shell, and progressively rendered UI components from streamed YAML. Included a 36-component catalog and a companion skill under `skills/pi-json-render-ui/`.

**Why it was shelved:** The streaming pipeline worked in principle, but the end-to-end experience wasn't reliable enough to keep shipping. Upstream `@json-render/react` error boundaries permanently null-rendered components after transient streaming-time prop errors, several `@json-render/shadcn` components weren't tolerant of partial props during streaming, and the overall model ergonomics needed more iteration. May revisit when the json-render ecosystem matures or if Glimpse gets a simpler patching model.

## env-skills (deleted)

**Removed:** 2026-04-02

**What it did:** Detected the current project environment (React as proof of concept) and automatically injected matching skills from `.pi/env-skills/` directories into the agent's available skills. Provided `/env-skills` and `/env-skills rescan` commands for inspection.

**Why it was shelved:** The detection and injection worked, but the injected skills were only advertised through prompt XML — they didn't become real `/skill:name` commands. The gap between "visible in prompt" and "actually loadable" created confusion. The concept of environment-scoped skill filtering is worth revisiting once Pi's skill registration API supports dynamic additions at runtime.
