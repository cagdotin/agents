# Documentation memory model

Status: accepted

This repository organizes documentation by memory type instead of treating all docs as one bucket. We keep **Domain memory** in `CONTEXT.md`, **Decision memory** in ADRs plus narrowly-used planning artifacts (`docs/specs/`, `docs/exec-plans/`), **Method memory** in skills and supporting references, **Architecture overview** in a thin `docs/ARCHITECTURE.md`, and **Agent configuration** in `docs/agents/`. We are retiring narrative scorecards, contributor handbooks, and report folders because they created overlap and drift; objective quality belongs in automation, backlog belongs in GitHub, and owned references should live next to the module, skill, or extension they explain.

## Consequences

- `docs/QUALITY.md`, `docs/CONTRIBUTING-DOCS.md`, and `docs/reports/` should be removed once all routing and tooling dependencies are updated.
- `docs/coding-conventions.md` should become the stable home for naming and style rules.
- `scripts/validate-docs.ts` should enforce the structural parts of this model, and the separate docs audit script should not exist.
- `docs/specs/` and `docs/exec-plans/` remain available only for genuinely complex, multi-session, or architecture-shaping work, with GitHub as the canonical backlog.
