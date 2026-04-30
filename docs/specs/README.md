# Specs

Keep specs here only while they are active working context for genuinely complex, multi-session, or architecture-shaping work.

## Use a spec when

- intent and constraints need to survive across sessions
- a fresh implementing agent would otherwise have to rediscover too much context
- the work crosses meaningful boundaries or introduces a new pattern

## Do not use a spec for

- routine fixes
- small local refactors
- backlog tracking
- generic implementation notes better kept in a GitHub issue

## Conventions

- Use `kebab-case` file names, with a date prefix when useful (for example `2026-03-07-feature-name.md`).
- Prefer generating specs via the `plan` skill.
- Cross-link specs from related execution plans when both artifacts exist.
- When a spec stops being active working context, archive it under `.graveyard/docs/specs/`.
