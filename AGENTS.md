# Agent Notes

This repository defines global commands, skills, extensions, and themes for coding agents.

## Where to Look First

- Repository architecture map: `docs/ARCHITECTURE.md`
- Current quality status and prioritized gaps: `docs/QUALITY.md`
- Documentation contribution rules: `docs/CONTRIBUTING-DOCS.md`
- Active execution plans and debt tracker: `docs/exec-plans/README.md`
- Implementation specs for planned/complex work: `docs/specs/`
- Pi extension API quick reference (repo-focused): `docs/references/pi-api-reference.md`
- External resources index and capture workflow: `docs/resources/README.md`
- Extension implementation reference (gold standard): `extensions/todos/`

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
