# Agent Notes

This repository defines global commands, skills, extensions, and themes for coding agents.

## Where to Look First

- Repository architecture map: `docs/ARCHITECTURE.md`
- Design principles for this repo: `docs/DESIGN-PRINCIPLES.md`
- Current quality status and prioritized gaps: `docs/QUALITY.md`
- Documentation contribution rules: `docs/CONTRIBUTING-DOCS.md`
- Active execution plans and debt tracker: `docs/exec-plans/README.md`
- Planning skill standard: `skills/plan/PLAN.md`
- Implementation specs for planned/complex work: `docs/specs/`
- Pi extension API quick reference (repo-focused): `docs/references/pi-api-reference.md`
- Conditional feature registration pattern: `docs/references/conditional-feature-registration.md`
- Extension implementations: `extensions/` (all follow the same structure)

## Discovering Information

For unfamiliar work, orient with the repo docs first:
- `docs/ARCHITECTURE.md` for module boundaries
- `docs/QUALITY.md` for current strengths and gaps
- `docs/references/` for local implementation patterns

Use `rg`/`grep` when you know the exact string, symbol, or file path.
Use `find`/directory listings when you need a quick map of the repo surface.
Read nearby implementation and tests before introducing new patterns.

## Golden Rules

1. **Reuse before inventing** — check `extensions/`, `lib/`, and `docs/references/` for an existing pattern before creating new ones.
2. **Validate at boundaries** — use TypeBox + `StringEnum` for tool params, and Zod for runtime boundary parsing (YAML/JSON/frontmatter/LLM output).
3. **Shared utilities over hand-rolled helpers** — extract common logic; don't duplicate across extensions.
4. **Every extension gets a README** — behavior, triggers, setup. No undocumented extensions.
5. **Repo is the system of record** — if it's not committed, it doesn't exist for agents. No chat-only decisions.
6. **Mechanical enforcement over convention memory** — if a rule matters, encode it in `bun run check`.
7. **Agent-legible error messages** — validation failures must say what's wrong, why it matters, and how to fix it.
8. **Medium+ work requires planning artifacts** — create both a spec (`docs/specs/`) and an execution plan (`docs/exec-plans/active/`) unless the user explicitly waives it.

## Coding Styles

- file and folder names - kebab-case only
- functions and variables - snake_case only
- types and classes - CamelCase

## Package Manager

- **Always use Bun in this repository.**
- Use `bun install`, `bun run <script>`, and `bunx <tool>`.
- Do not use `npm`, `npx`, `yarn`, or `pnpm`.

## Git Rules

- **Never commit or push without explicit user approval.** All code must be reviewed first.
- Only run `git commit` or `git push` when the user explicitly tells you to.

## Extensions

- Pi extensions live in `./extensions`.
- When working in this repo, add or update extensions there.
- You can consult pi-mono for reference, but do not modify code in pi-mono.
