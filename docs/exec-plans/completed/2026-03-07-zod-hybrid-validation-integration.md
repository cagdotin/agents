# Zod Hybrid Validation Integration — Execution Plan

Status: Completed
Owner: agent
Created: 2026-03-07
Spec: [[docs/specs/2026-03-07-zod-hybrid-validation-integration.md]]

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

This plan conforms to `skills/plan/PLAN.md`.

## Purpose / Big picture

After this work, repository runtime boundaries (YAML/JSON/frontmatter/LLM-JSON parsing) will be protected by explicit Zod schemas while Pi tool registration remains TypeBox-compatible. Users and agents should see more consistent, actionable validation errors, and malformed data should fail early and predictably.

Observable outcomes:
- boundary parsers reject malformed input with stable diagnostics,
- existing valid files still parse correctly,
- `registerTool().parameters` contracts stay unchanged,
- `bun run check` remains green.

## Progress

- [x] (2026-03-07 15:25 CET) Milestone 1: Foundation (dependency + schema conventions)
- [x] (2026-03-07 15:28 CET) Milestone 2: Phase A integrations (`answer`, `validate-docs`)
- [x] (2026-03-07 15:31 CET) Milestone 3: Phase B integrations (`damage-control`, `expert`)
- [x] (2026-03-07 15:32 CET) Milestone 4: Phase C integration (`todos` targeted boundaries)
- [x] (2026-03-07 15:33 CET) Milestone 5: Tests, regression sweep, docs updates

## Surprises & discoveries

- Observation: Pi extension typing expects TypeBox `TSchema` for tool parameters (`ToolDefinition<TParams extends TSchema>`).
  Evidence: `@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`.

- Observation: Repository guidance explicitly prefers `StringEnum` for tool enum compatibility (especially Google providers).
  Evidence: `docs/references/pi-api-reference.md`.

- Observation: Validation logic is currently concentrated in manual parsers and shape guards across `damage-control`, `expert`, `todos`, `answer`, and `scripts/validate-docs.ts`.
  Evidence: direct code scan of the listed modules.

- Observation: `YAML.parse(..., { schema: "failsafe" })` keeps frontmatter scalars as strings, which avoids accidental boolean/number coercion in docs validation.
  Evidence: local Bun REPL checks + `scripts/validate-docs.ts` integration tests.

- Observation: Strict object-level Zod schemas can over-reject mixed-valid settings payloads; preprocessing per field preserves backward-compatible fallback behavior.
  Evidence: `extensions/expert/storage.ts` and `extensions/todos/storage.ts` tests for “valid fields + invalid field types”.

## Decision log

- Decision: Use a hybrid strategy (TypeBox for tool params, Zod for runtime boundaries).
  Rationale: preserves Pi tool compatibility while gaining stronger runtime parsing guarantees.
  Date/Author: 2026-03-07 / user + agent

- Decision: Do not attempt full TypeBox→Zod migration for `registerTool().parameters`.
  Rationale: Pi contracts and repository conventions are TypeBox-first; forcing conversion introduces unnecessary risk.
  Date/Author: 2026-03-07 / agent

- Decision: Roll out in phases, starting with low-risk modules.
  Rationale: minimizes blast radius and allows schema/diagnostic conventions to stabilize before touching high-volume parsers.
  Date/Author: 2026-03-07 / agent

- Decision: For docs frontmatter, parse YAML with `failsafe` schema and validate with Zod contracts.
  Rationale: preserves string-oriented validation behavior while supporting proper YAML lists/block scalars.
  Date/Author: 2026-03-07 / agent

- Decision: Use tolerant Zod preprocessing on settings payloads instead of hard-failing entire objects.
  Rationale: keeps compatibility semantics (valid fields still apply, invalid ones fall back to defaults).
  Date/Author: 2026-03-07 / agent

## Outcomes & retrospective

Completed outcomes:
- Added `zod` runtime dependency (`package.json`, `bun.lock`).
- Integrated schema-backed parsing in:
  - `extensions/answer/extraction.ts` (LLM JSON result contract),
  - `scripts/validate-docs.ts` (resource/skill frontmatter contracts + YAML parsing),
  - `extensions/damage-control/rules-loader.ts` (rules file + bash entry validation),
  - `extensions/expert/storage.ts` (expertise header/settings/reflection-log payloads),
  - `extensions/todos/storage.ts` (frontmatter/settings/lock payload validation).
- Added regression coverage for malformed/compatibility paths:
  - `scripts/__tests__/validate-docs.test.ts` (new),
  - updated tests in `answer`, `damage-control`, `expert`, and `todos` storage suites.
- Verified full quality gate:
  - `bun run test` ✅
  - `bun run check` ✅

Retrospective:
- Hybrid TypeBox (tool params) + Zod (runtime boundaries) worked cleanly without changing `registerTool().parameters` interfaces.
- Tolerant parsing behavior was preserved by combining Zod with controlled defaults/preprocessing instead of strict object rejection.

## Context and orientation

Relevant repository constraints and references:

- Architecture and package constraints: `docs/ARCHITECTURE.md`
- Quality posture and current testing notes: `docs/QUALITY.md`
- Pi API reference (repo conventions): `docs/references/pi-api-reference.md`
- Spec for this initiative: `docs/specs/2026-03-07-zod-hybrid-validation-integration.md`

Primary implementation surfaces:

- `extensions/answer/extraction.ts`
- `scripts/validate-docs.ts`
- `extensions/damage-control/rules-loader.ts`
- `extensions/expert/storage.ts`
- `extensions/todos/storage.ts`
- `package.json`

Test surfaces expected to change:

- `extensions/answer/__tests__/extraction.test.ts`
- `extensions/damage-control/__tests__/rules-loader.test.ts`
- `extensions/expert/__tests__/storage.test.ts`
- `extensions/todos/__tests__/storage.test.ts`
- `scripts/__tests__/validate-docs.test.ts` (new)

## Plan of work

### Milestone 1 — Foundation

1. Add `zod` as package-level runtime dependency.
2. Define schema authoring conventions:
   - per-module local schema files or local schema sections,
   - consistent naming (`XSchema`, `parse_x`, `try_parse_x`),
   - consistent error formatting strategy.
3. Confirm no changes to tool TypeBox schema modules.

Result: Zod is available and conventions are documented in code via first implementations.

### Milestone 2 — Phase A (low-risk)

1. Integrate Zod in `extensions/answer/extraction.ts` for response JSON structure.
2. Integrate Zod in `scripts/validate-docs.ts` for frontmatter contracts.
3. Add/adjust tests for both modules, including malformed inputs.

Result: first production usage in low-risk boundaries with clear pass/fail behavior.

### Milestone 3 — Phase B (core safety)

1. Integrate Zod schema validation in `extensions/damage-control/rules-loader.ts`.
2. Integrate Zod schema validation in `extensions/expert/storage.ts`.
3. Preserve existing warning/fallback semantics while replacing ad-hoc shape checks.
4. Expand tests for invalid entry handling and compatibility behavior.

Result: main guardrail/config parsers are schema-backed.

### Milestone 4 — Phase C (targeted todos hardening)

1. Integrate Zod validation for normalized todo frontmatter/settings/lock records in `extensions/todos/storage.ts`.
2. Keep legacy JSON-frontmatter migration and tolerant parsing behavior intact.
3. Expand tests to include backward compatibility fixtures.

Result: high-usage todo persistence boundaries gain schema guarantees without breaking existing files.

### Milestone 5 — Final hardening

1. Run full validation pipeline (`bun run check`).
2. Review and polish error texts for agent legibility.
3. Update quality notes if risk posture meaningfully improves.
4. Prepare follow-up issues for any deferred strictness changes.

Result: migration complete, tested, and documented.

## Concrete steps

Working directory: `/Users/cgn/git/0xcgn/agents`

### Milestone 1

```bash
bun add zod
```

Expected outcome:
- `package.json` contains `zod` dependency,
- lockfile updated.

### Milestone 2+

```bash
# iterative test runs while editing
bun run test

# final gate
bun run check
```

Expected outcome:
- all tests pass,
- no biome/docs regressions,
- no type errors from added schemas.

## Validation and acceptance

Functional acceptance:

1. Invalid structured input (rules/frontmatter/LLM JSON) is rejected with deterministic errors.
2. Valid existing artifacts continue to parse with unchanged behavior.
3. Tool declarations continue using TypeBox + `StringEnum` unchanged.

Command acceptance:

```bash
bun run test
bun run check
```

Manual spot checks:
- load damage-control with malformed rule snippets and confirm warning behavior,
- parse sample expertise/todo legacy files and confirm compatibility,
- run docs validation against representative resource/skill fixtures.

## Idempotence and recovery

- Migration is incremental; each milestone is independently mergeable and testable.
- If strict validation breaks compatibility, temporarily switch specific schemas to permissive mode (`.passthrough()` / optional fields) and log decision.
- Keep parser fallbacks until fixtures prove strict mode is safe.
- If a milestone regresses behavior, revert only that module’s schema integration and continue with others.

## Artifacts and notes

Delivered artifacts:
- New/updated schema blocks in target modules (`answer`, `damage-control`, `expert`, `todos`, docs validator).
- Expanded malformed-input coverage across affected test suites.
- Updated package manifest and lockfile with `zod` dependency.

Evidence snippets:
- `bun run test` (15 files / 348 tests) passed after integrations.
- `bun run check` passed (Biome + docs validator + tests).

## Interfaces and dependencies

Required external dependency:
- `zod` (runtime validation for parsed external data)

Required existing interfaces to preserve:
- Pi tool registration (`ToolDefinition<TParams extends TSchema>`) via TypeBox
- `StringEnum` usage in tool parameter enums

Module-level contracts to preserve:
- existing error/warning return shapes in `damage-control` loader,
- existing fallback behavior in `expert`/`todos` storage,
- existing docs validator output format (agent-legible hints).
