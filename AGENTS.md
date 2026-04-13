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

This repo is indexed by [QMD](https://github.com/tobi/qmd), a local hybrid search engine.

**Use QMD before `rg` when:**
- **Starting unfamiliar work** — `qmd query -c agents "how does X work"` before reading random files
- **Checking for prior decisions** — `qmd query -c agents "why was X designed this way"` before proposing changes
- **Looking for patterns** — `qmd query -c agents "how do other extensions handle Y"` before inventing new ones
- **Finding related specs/plans** — `qmd query -c agents "specs about X feature"` before creating a new spec
- **Searching for concepts** — when you know *what* you need but not *where* it lives or what it's called

**Use `rg`/`grep` instead** when you know the exact string, variable name, or file path.

```bash
# Semantic search (best quality — expansion + BM25 + vector + reranking)
qmd query -c agents "your question here"

# Keyword search (fast, no LLM, good for exact terms)
qmd search "exact keywords" -c agents

# Get a specific document by path
qmd get "docs/ARCHITECTURE.md"
```

Always pass `-c agents` to scope results to this repo. See `extensions/qmd/skills/qmd/SKILL.md` for the full reference.

## Golden Rules

1. **Reuse before inventing** — run `qmd query -c agents "existing utility for X"` and check `extensions/` before creating new ones.
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
