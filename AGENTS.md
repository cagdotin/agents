# Agent Notes

This repository defines shared extensions, skills, themes, and support docs for coding agents.

## Agent skills

### Issue tracker

Issues are tracked in GitHub and should be accessed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles currently map directly to same-named labels in this repo. See `docs/agents/triage-labels.md`.

### Domain docs

Treat this repo as single-context: prefer a root `CONTEXT.md` and `docs/adr/` when they exist. See `docs/agents/domain.md`.

## Where to look first

- Repository architecture overview: `docs/ARCHITECTURE.md`
- Design principles for this repo: `docs/DESIGN-PRINCIPLES.md`
- Coding conventions: `docs/coding-conventions.md`
- Testing conventions: `docs/TESTING.md`
- Complex-work planning artifacts: `docs/exec-plans/README.md` and `docs/specs/README.md`
- Pi extension API quick reference (repo-focused): `docs/references/pi-api-reference.md`
- Conditional feature helper reference: `lib/extension-runtime/conditional-feature.md`
- Extension implementations: `extensions/`

## Discovering information

For unfamiliar work, orient with the repo docs first:
- `docs/ARCHITECTURE.md` for the bird's-eye codemap and boundaries
- `CONTEXT.md` and `docs/adr/` for domain language and durable decisions
- `docs/references/` only for shared repo-wide references
- owner-adjacent docs next to the module, skill, or extension when a pattern has a natural owner

Use `rg`/`grep` when you know the exact string, symbol, or file path.
Use `find`/directory listings when you need a quick map of the repo surface.
Read nearby implementation and tests before introducing new patterns.

## Golden rules

1. **Reuse before inventing** — check `extensions/`, `lib/`, and shared references for an existing pattern before creating new ones.
2. **Validate at boundaries** — use TypeBox + `StringEnum` for tool params, and Zod for runtime boundary parsing (YAML/JSON/frontmatter/LLM output).
3. **Shared utilities over hand-rolled helpers** — extract common logic; don't duplicate across extensions.
4. **Every extension gets a README** — behavior, triggers, setup. No undocumented extensions.
5. **Repo is the system of record** — if it's not committed, it doesn't exist for agents. No chat-only decisions.
6. **Mechanical enforcement over convention memory** — if a rule matters, encode it in `pnpm run check` and make it reachable through the Vite+ workflow.
7. **Agent-legible error messages** — validation failures must say what's wrong, why it matters, and how to fix it.
8. **Complex work requires planning artifacts** — for genuinely complex, multi-session, or architecture-shaping work, create both a spec (`docs/specs/`) and an execution plan (`docs/exec-plans/active/`) unless the user explicitly waives them.

## Coding styles

See `docs/coding-conventions.md`.

## Package manager

- **Use pnpm in this repository.**
- Use `pnpm install` for dependency installation and `pnpm run <script>` for repo-defined scripts.
- Prefer `vp run <script>` when you want to invoke repo-defined tasks through the Vite+ command surface.
- Use `vp test` for the built-in Vite+ Vitest loop.
- Use `pnpm exec <tool>` when you need a package-local binary that is not exposed through Vite+.

## Git rules

- **Never commit or push without explicit user approval.** All code must be reviewed first.
- Only run `git commit` or `git push` when the user explicitly tells you to.

## Extensions

- Pi extensions live in `./extensions`.
- When working in this repo, add or update extensions there.
- You can consult pi-mono for reference, but do not modify code in pi-mono.
- To retire an extension, follow `.graveyard/PROCESS.md` — write a rebuild spec, summarize references, delete source and related docs.
