# Zod Hybrid Validation Integration (TypeBox-Compatible)

Status: Draft
Date: 2026-03-07
Execution plan: [[docs/exec-plans/completed/2026-03-07-zod-hybrid-validation-integration.md]]

## 1. Problem statement

The repository currently validates most runtime data with hand-written guards and normalization logic spread across extensions and scripts. This works, but has three long-term risks:

1. validation logic is duplicated and drifts over time,
2. error reporting can become inconsistent across modules,
3. malformed YAML/JSON/frontmatter can bypass assumptions and create subtle bugs.

At the same time, Pi tool registration currently expects TypeBox schemas (`TSchema`) for `registerTool().parameters`, and this repo also relies on `StringEnum` compatibility guidance for tool enums. A full Zod replacement for tool schemas is not practical today without adapters and risk.

Desired end state:
- Keep TypeBox + `StringEnum` for tool parameter schemas.
- Introduce Zod for runtime boundary parsing/validation in extension internals and scripts.
- Improve safety and consistency without disrupting Pi tool compatibility.

## 2. Goals and non-goals

### 2.1 Goals

- Add Zod as a first-class runtime validation library in this package.
- Standardize boundary parsing with `safeParse` + normalized error mapping.
- Reduce ad-hoc shape checks in high-value parsing surfaces:
  - `extensions/damage-control/rules-loader.ts`
  - `extensions/expert/storage.ts`
  - `extensions/todos/storage.ts` (targeted surfaces)
  - `extensions/answer/extraction.ts`
  - `scripts/validate-docs.ts`
- Keep existing agent-legible error quality (what failed, why it matters, how to fix).
- Expand tests so invalid input paths are explicitly covered and stable.

### 2.2 Non-goals

- Replacing TypeBox tool schemas in `extensions/*/types.ts`.
- Introducing a TypeBox↔Zod conversion layer for `registerTool().parameters`.
- Rewriting all parsing logic in one pass (incremental adoption only).
- Cross-extension coupling; each extension keeps local schema ownership.

## 3. System context

Current implementation characteristics:

- Tool params are TypeBox-backed in:
  - `extensions/todos/types.ts`
  - `extensions/expert/types.ts`
- Manual/imperative parsing + validation appears in:
  - `extensions/damage-control/rules-loader.ts`
  - `extensions/expert/storage.ts`
  - `extensions/todos/storage.ts`
  - `scripts/validate-docs.ts`
  - `extensions/answer/extraction.ts`
- Docs and repo guidance require boundary validation and agent-legible errors.

Relevant architectural constraints:
- Extension dependencies are package-level (`docs/ARCHITECTURE.md`).
- No cross-extension runtime dependencies.
- `bun run check` is the quality gate.

## 4. Domain model and validation contract

## 4.1 Validation layers

1. **Tool interface layer (unchanged):** TypeBox + `StringEnum` for Pi tool schemas.
2. **Runtime boundary layer (new/expanded):** Zod for data entering module logic from files, YAML, JSON, and LLM output.
3. **Domain normalization layer:** keep current normalization where needed, but validate final shapes with Zod before use.

## 4.2 Error contract

All Zod failures should be mapped into existing error style:
- explicit failure category,
- actionable reason,
- fix hint when user-editable input is involved.

Avoid leaking raw Zod internals directly to end users.

## 5. Detailed design

### 5.1 Foundation

1. Add runtime dependency:
   - `zod` in package-level dependencies.
2. Add local schema modules (per extension/script) instead of a shared cross-extension schema package.
3. Add helper conventions (not necessarily shared code):
   - `parse_*` for strict parse (throws or error result)
   - `try_parse_*` for tolerant parse (`safeParse` result)
   - `format_zod_error` style helper per module where user-facing messaging exists.

### 5.2 Integration surfaces (phased)

#### Phase A (low-risk wins)

1. `extensions/answer/extraction.ts`
   - Validate extracted JSON with `ExtractionResultSchema` before return.
   - Keep markdown-fence stripping logic; replace structural check (`Array.isArray(parsed.questions)`) with Zod.

2. `scripts/validate-docs.ts`
   - Parse frontmatter block with YAML parser (`yaml` package) or normalize existing parser output into typed objects validated by Zod.
   - Add schemas for resource and skill frontmatter contracts.
   - Preserve existing human-readable hints.

#### Phase B (core safety boundaries)

3. `extensions/damage-control/rules-loader.ts`
   - Add `RawRulesFileSchema` and nested rule schemas.
   - Validate source file structure once, then normalize/compile regex.
   - Keep unknown-key warnings and invalid-entry counting behavior.

4. `extensions/expert/storage.ts`
   - Validate parsed expertise header and reflection log entry payloads with Zod.
   - Keep tolerant fallback behavior for unreadable/malformed files.

#### Phase C (targeted high-volume parser hardening)

5. `extensions/todos/storage.ts`
   - Keep current frontmatter splitting/migration behavior (YAML + legacy JSON).
   - Validate normalized frontmatter/settings/lock payloads with Zod before returning typed objects.
   - Preserve backward compatibility with legacy todo files.

### 5.3 Keep TypeBox where required

No changes to:
- `extensions/todos/types.ts` tool params
- `extensions/expert/types.ts` tool params
- any Pi `registerTool({ parameters })` contract

Rationale: Pi API types and repo conventions are TypeBox-first for tool definitions.

### 5.4 Testing strategy alignment

For each integrated module, add tests for:
- valid input path,
- malformed input path,
- partially-valid fallback behavior,
- user-facing error text where applicable.

Specific additions:
- `scripts/__tests__/validate-docs.test.ts` (already listed as gap in existing planning docs).

## 6. Error handling and failure modes

### `zod_validation_failure`
- Trigger: input shape mismatch.
- Handling: return current module’s structured error/warning shape; include concise fix guidance.

### `strictness_regression`
- Trigger: existing real-world files fail newly strict schema.
- Handling: use `.passthrough()` / permissive defaults where backward compatibility is required; document stricter fields explicitly.

### `parsing_pipeline_mismatch`
- Trigger: parser output and schema assumptions diverge.
- Handling: add explicit normalization step before schema validation; test representative legacy fixtures.

## 7. Security and safety considerations

- Parse-at-boundary reduces unsafe assumptions from untrusted file content.
- Schema-backed parsing lowers risk of silent coercion/shape confusion bugs.
- Consistent validation blocks malformed data before mutation logic executes.
- Tool schema compatibility remains intact by not replacing TypeBox in Pi interfaces.

## 8. Testing strategy

### 8.1 Unit tests

- Add/expand tests in:
  - `extensions/answer/__tests__/extraction.test.ts`
  - `extensions/damage-control/__tests__/rules-loader.test.ts`
  - `extensions/expert/__tests__/storage.test.ts`
  - `extensions/todos/__tests__/storage.test.ts`
  - `scripts/__tests__/validate-docs.test.ts`

### 8.2 Validation checks

- `bun run test`
- `bun run check`

Acceptance criteria:
- No regression in current behavior for valid inputs.
- Invalid input paths return deterministic, agent-legible diagnostics.
- TypeBox-based tool parameter schemas remain unchanged and functional.

## 9. Implementation checklist

- [ ] Add `zod` runtime dependency at package level.
- [ ] Define per-module Zod schemas for selected boundary surfaces.
- [ ] Integrate Zod parsing in `extensions/answer/extraction.ts`.
- [ ] Integrate Zod validation in `scripts/validate-docs.ts`.
- [ ] Integrate Zod validation in `extensions/damage-control/rules-loader.ts`.
- [ ] Integrate Zod validation in `extensions/expert/storage.ts`.
- [ ] Integrate targeted Zod validation in `extensions/todos/storage.ts`.
- [ ] Add/expand tests for all new validation paths.
- [ ] Run `bun run check` and resolve regressions.
- [ ] Update `docs/QUALITY.md` with validation/testing impact if behavior materially changes.

## 10. Open questions

1. Should frontmatter parsing in `scripts/validate-docs.ts` switch to full YAML parse immediately, or keep current parser and only add schema validation after normalization?
   - Recommended default: switch to YAML parse in script (lower maintenance, better schema fidelity), but keep error hints stable.

2. Do we want one optional local helper (`format_zod_issues`) duplicated by module, or a tiny shared utility outside extensions?
   - Recommended default: start local per module; only extract after 3+ identical implementations.

3. How strict should unknown keys be for user-authored files?
   - Recommended default: warn-and-ignore for compatibility (current behavior), not hard-fail.
