# Documentation Map

This directory holds the repository's durable support docs. The docs are organized by memory type so readers can route quickly instead of treating everything as one bucket.

Tooling policy: examples and commands in docs should use **Bun** (`bun`, `bun run`, `bunx`).

## Categories

| Location | Kind | Use it for |
|---|---|---|
| `../CONTEXT.md` | Domain memory | Canonical repo vocabulary and concept boundaries |
| `ARCHITECTURE.md` | Architecture overview | Stable bird's-eye view of the package and where to look next |
| `DESIGN-PRINCIPLES.md` | Enduring constraints | Why this repo is shaped the way it is |
| `coding-conventions.md` | Stable conventions | Naming and style rules that code and docs should follow |
| `TESTING.md` | Testing conventions | Repo-specific testing rules, tiers, and safety boundaries |
| `adr/` | Decision memory | Durable architecture and scope decisions |
| `specs/` | Planning artifacts | Design contracts for genuinely complex work |
| `exec-plans/` | Planning artifacts | Execution state for genuinely complex work |
| `agents/` | Agent configuration | Repo-local settings that shared skills need |
| `references/` | Shared references | Repo-wide references with no narrow owner |

## Reading guide

| If you need... | Read... |
|---|---|
| the bird's-eye view | `ARCHITECTURE.md` |
| the repo's vocabulary | `../CONTEXT.md` |
| the reasoning behind stable constraints | `DESIGN-PRINCIPLES.md` |
| naming/style rules | `coding-conventions.md` |
| testing expectations | `TESTING.md` |
| a durable trade-off or architecture decision | `adr/` |
| design or execution context for complex work | `specs/` or `exec-plans/` |
| repo-local skill settings | `agents/` |
| a shared implementation reference | `references/` |

## Notes

- GitHub issues are the canonical backlog and follow-up tracker.
- References with a clear owner should live next to that owner, not in top-level `references/`.
