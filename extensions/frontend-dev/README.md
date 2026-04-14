# frontend-dev Extension

Conditionally exposes frontend-focused skills when the current repo looks like a React or Next.js project.

## What it does

- reads `package.json` from the current Pi working directory during extension initialization
- detects whether the repo depends on `react`, `next`, or `shadcn`
- exposes a base frontend design skill set for frontend repos only
- adds framework-specific skills when matching dependencies are present
- shows a small footer status (`fe-dev`) when active

## Detection rules

The extension enables itself when either of these dependencies exists in `package.json`:

- `react`
- `next`

Additional skills are exposed when these dependencies are present:

- `react` → `vercel-react-best-practices`
- `next` → `next-best-practices`
- `shadcn` → `shadcn`

If no frontend dependencies are detected, the extension stays inactive and exposes no skills.

## Lifecycle model

- `session_start` — initialize dependency state from `ctx.cwd`, then set footer status once when enabled
- `resources_discover` — expose frontend skills derived from initialized dependency state

The extension relies on the shared conditional feature helper's one-time state model.
Pi reloads and rebinds extensions for `/new`, `/resume`, `/fork`, and `/reload`, so the dependency state is recomputed for each replacement runtime.

## Files

- `index.ts` — dependency detection and conditional feature registration
- `skills/frontend-design/` — design-oriented frontend skill
- `skills/web-design-guidelines/` — general web design guidance
- `skills/vercel-react-best-practices/` — React-specific guidance
- `skills/next-best-practices/` — Next.js-specific guidance
- `skills/shadcn/` — shadcn usage guidance

## Requirements

- a `package.json` in the current repo
- frontend dependencies present in one of the dependency blocks the extension checks
