# Conditional feature stateful helper and doc sync

Status: Completed
Owner: pi
Created: 2026-04-14
Spec: [[docs/specs/2026-04-14-conditional-feature-stateful-helper-and-doc-sync]]

This ExecPlan is a living document and was maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

Align the conditional feature helper's tests and docs with the current state-driven implementation, and confirm from upstream Pi lifecycle docs whether one-time initialized helper state is safe for frontend-dev.

## Progress

- [x] (2026-04-14 18:20 UTC) Audited the live helper implementation, frontend-dev usage, stale tests/docs, and upstream Pi lifecycle docs.
- [x] (2026-04-14 18:20 UTC) Updated helper tests to match the current state-driven API.
- [x] (2026-04-14 18:20 UTC) Refreshed local reference docs and added the missing frontend-dev README.
- [x] (2026-04-14 18:20 UTC) Validated with targeted tests, full tests, and docs checks.

## Surprises & Discoveries

- Observation: Upstream Pi explicitly reloads and rebinds extensions after `/new`, `/resume`, `/fork`, and `/reload`.
  Evidence: `docs/extensions.md` states that after successful switch/fork/reload, Pi emits `session_shutdown` for the old instance, then reloads and rebinds extensions before the next `session_start`.

- Observation: The failing helper tests were still written for two older helper APIs, not the current implementation.
  Evidence: The test file still referenced `__testing__`, eager `enabled`, resolver-based `skills`, and async init behavior that the current helper no longer exposes.

- Observation: Repo docs validation also failed independently because `extensions/frontend-dev/README.md` did not exist.
  Evidence: `bun run check:docs` reported the missing README as the only docs validation issue.

## Decision log

- Decision: Treat the current state-driven helper implementation as the source of truth.
  Rationale: The user explicitly refactored the helper and asked for tests/docs to match the new implementation.
  Date/Author: 2026-04-14 / pi

- Decision: Document one-time state initialization as safe for session replacement flows.
  Rationale: Upstream Pi docs say those flows tear down the old extension runtime and rebind a new one before `session_start`.
  Date/Author: 2026-04-14 / pi

## Outcomes & Retrospective

Completed outcomes:
- Tests now target the state-driven helper.
- Reference docs now describe the live helper API and its lifecycle assumptions.
- frontend-dev now has required extension documentation.

Remaining gaps:
- None for this scope.

## Context and orientation

Key files:
- `lib/extension-runtime/conditional-feature.ts`
- `lib/extension-runtime/__tests__/conditional-feature.test.ts`
- `docs/references/conditional-feature-registration.md`
- `docs/references/pi-api-reference.md`
- `extensions/frontend-dev/index.ts`
- `extensions/frontend-dev/README.md`
- upstream Pi docs: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

## Plan of work

1. Confirm the current helper contract from source.
2. Verify Pi lifecycle semantics from upstream docs.
3. Rewrite tests/docs to reflect the live implementation.
4. Add missing extension docs and rerun validation.

## Concrete steps

All commands were run from `/Users/cgn/git/dev/0xcgn/agents`.

- Audit references and helper usage:
  - `rg -n "register_conditional_feature|FeatureState|get_skills|get_prompts|get_instructions" lib extensions docs`
- Inspect upstream lifecycle docs:
  - `rg -n "session_start|session_shutdown|reloads and rebinds extensions|ctx.reload" /opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- Validate:
  - `bun run vitest run lib/extension-runtime/__tests__/conditional-feature.test.ts`
  - `bun run test`
  - `bun run check:docs`

## Validation and acceptance

Success criteria:
- helper tests pass,
- repo tests pass,
- docs validation passes,
- docs explain why one-time helper state is safe for frontend-dev under Pi lifecycle semantics.

Observed validation:
- `bun run vitest run lib/extension-runtime/__tests__/conditional-feature.test.ts` passed.
- `bun run test` passed.
- `bun run check:docs` passed.

## Idempotence and recovery

- Test and doc updates are safe to re-run.
- If lifecycle assumptions change upstream, revisit the helper docs and frontend-dev state model first.

## Artifacts and notes

- Spec: [[docs/specs/2026-04-14-conditional-feature-stateful-helper-and-doc-sync]]

## Interfaces and dependencies

- Pi extension lifecycle from `@mariozechner/pi-coding-agent`
- Repo docs validation via `scripts/validate-docs.ts`
- Vitest for helper contract tests