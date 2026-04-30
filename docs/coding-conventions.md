# Coding conventions

Status: active
Last updated: 2026-04-30

These are the stable naming and style rules for this repository.

## Naming

- **Files and directories**: `kebab-case`
- **Functions and variables**: `snake_case`
- **Types and classes**: `CamelCase`

## Documentation files

Use `kebab-case.md` for ordinary documentation files.

Allowed convention-driven exceptions include:
- `README.md`
- `SKILL.md`
- `PLAN.md`
- `AGENTS.md`
- `CONTEXT.md`

## Tooling language

- Use **Bun** commands in examples and instructions: `bun`, `bun run`, `bunx`
- Do not document `npm`, `npx`, `yarn`, `pnpm`, or other package-manager alternatives in this repo

## Notes

If an upstream API or external contract forces a different naming style in a narrow location, keep the exception local and do not spread it as a repo convention.
