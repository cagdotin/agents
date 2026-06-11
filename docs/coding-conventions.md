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

- Use **pnpm** commands for package-manager actions in examples and instructions: `pnpm install`, `pnpm run`, `pnpm exec`
- Use **Vite+** commands when invoking repo tasks or the built-in test runner: `vp run <script>`, `vp test`
- Do not document Bun as the primary package-manager workflow in this repo

## Notes

If an upstream API or external contract forces a different naming style in a narrow location, keep the exception local and do not spread it as a repo convention.
