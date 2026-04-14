# Conditional feature stateful helper and doc sync

Status: Completed
Date: 2026-04-14
Execution plan: [[docs/exec-plans/completed/2026-04-14-conditional-feature-stateful-helper-and-doc-sync]]

## 1. Problem statement

`lib/extension-runtime/conditional-feature.ts` has been refactored toward a state-driven helper contract, but its tests and reference docs still describe older APIs. The frontend-dev extension also needs a clear answer on whether one-time initialized state is safe under Pi's actual session lifecycle semantics.

## 2. Goals and non-goals

### 2.1 Goals
- Align helper tests with the current state-driven implementation.
- Refresh reference docs so they describe the live helper API, not prior iterations.
- Document whether one-time helper state is safe across Pi startup, reload, new, resume, and fork flows.
- Add missing extension documentation required by repo checks.

### 2.2 Non-goals
- Reworking the helper contract again.
- Introducing cwd-refresh logic beyond what the current implementation already does.
- Changing unrelated extensions.

## 3. System context

Affected surfaces:
- `lib/extension-runtime/conditional-feature.ts`
- `lib/extension-runtime/__tests__/conditional-feature.test.ts`
- `docs/references/conditional-feature-registration.md`
- `docs/references/pi-api-reference.md`
- `extensions/frontend-dev/index.ts`
- `extensions/frontend-dev/README.md`

External lifecycle source of truth:
- upstream Pi extension docs in `docs/extensions.md`

## 4. Detailed design

### 4.1 Helper contract
- The helper is now state-driven: `init(ctx)` produces `FeatureState`, then hook behavior reads `enabled`, `get_skills`, `get_prompts`, and `get_instructions` from that state.
- The helper owns no eager-value compatibility layer; docs and tests should reflect the simpler contract.
- The helper is fail-loud: initialization and activation errors should surface.

### 4.2 Lifecycle conclusion
- Pi emits `session_shutdown`, reloads and rebinds extensions, then emits `session_start` for `/new`, `/resume`, `/fork`, and `/reload`.
- Because the extension runtime is rebound for those transitions, one-time initialized helper state is safe across those session-replacement boundaries.
- Within-session events such as `session_tree` and `session_compact` do not imply cwd replacement, so the helper does not need automatic re-init for the current frontend-dev use case.

### 4.3 Documentation updates
- Reference docs should explicitly call out the state-driven helper contract and sync-only one-time initialization model.
- Docs should include the lifecycle rationale so future contributors know why one-time state is acceptable here.

## 5. Error handling and failure modes

- `init(ctx)` and `activate(ctx, state)` errors are expected to fail loud.
- Helper tests should verify public behavior rather than outdated internal testing hooks.
- README validation must pass by documenting `extensions/frontend-dev`.

## 6. Testing strategy

### 6.1 Automated checks
- Run the helper test file directly.
- Run the full repo test suite.
- Run docs validation.

### 6.2 Behavioral verification
- Confirm one-time state initialization is reused within a single extension runtime.
- Confirm disabled state suppresses activation/resources/instructions.
- Confirm lifecycle docs support the one-time state model.

## 7. Implementation checklist
- [x] Update helper tests to the current API.
- [x] Refresh reference docs to the current API and lifecycle rationale.
- [x] Add missing frontend-dev README.
- [x] Validate with tests and docs checks.

## 8. Open questions
- None.