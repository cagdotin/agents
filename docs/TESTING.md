# TESTING

Status: active
Last updated: 2026-04-30

This file gives the testing model for this repository. Keep it focused on repo-specific conventions, not generic Vitest advice.

---

## Quick reference

```bash
bun run test          # Run all tests once
bun run test:watch    # Re-run on file changes
bun run test:coverage # Coverage report for inspection
bun run check         # Full quality gate
```

Tests are part of the Lefthook pre-commit gate alongside lint, docs validation, and boundary checks.

---

## Test runner

Tests use **Vitest** via Bun. Configuration lives in `vitest.config.ts`.

The important repo-specific behavior is:
- global test APIs are enabled
- `@mariozechner/*` peer dependencies are redirected to shared mocks
- test file discovery is configured centrally

---

## Core conventions

### Placement

Co-locate tests with the code they cover:

- `extensions/<name>/__tests__/<module>.test.ts`
- `lib/**/__tests__/<module>.test.ts`
- `scripts/__tests__/<script>.test.ts`

Static fixtures belong in `__tests__/fixtures/`.

### Filesystem isolation

For file I/O tests, use `os.tmpdir()` and isolate each test or suite so tests do not share state.

### Shared mocks

Shared mocks for `@mariozechner/*` packages live in `extensions/__mocks__/` and are wired in through Vitest aliases. Tests should use those mocks instead of trying to reach the real Pi runtime.

Keep mocks minimal. Add only the exports that tests actually need.

---

## Tiered testing model

Use this repo-specific rule of thumb:

| Tier | Use for | Approach | Status |
|---|---|---|---|
| 1 | Pure logic with no Pi imports | Test directly | Expected |
| 2 | Logic that imports Pi packages but is still mostly transformation/matching code | Test with shared mocks | Expected |
| 3 | Deep Pi runtime coupling: extension lifecycle, commands, TUI rendering, subprocess-heavy code | Defer for now | Not currently covered |

Examples of Tier 1 and Tier 2 code: parsers, validators, matchers, storage helpers, formatters, policy evaluation, and other logic that can run outside the real Pi session runtime.

Examples of Tier 3 code: `index.ts`, slash commands, TUI components, lifecycle hooks, and code that spawns real Pi or LLM subprocesses.

If a module is hard to test, prefer extracting the logic into a Tier 1 or Tier 2 module rather than forcing runtime-heavy tests.

---

## What to test

Test behavior that carries real risk:
- parsing and validation
- matching and routing logic
- file read/write behavior
- formatting with meaningful branching
- edge cases and failure paths

Do not spend tests on things the repo can already tell you quickly:
- type-only modules
- constants-only modules
- trivial re-exports
- glue code with no meaningful logic
- Tier 3 runtime wiring that we do not yet have a harness for

---

## Safety rules

Tests must never:
- write outside `os.tmpdir()`
- spawn real `pi` processes
- make real LLM API calls
- depend on secrets, API keys, or machine-specific paths

The default mocks should fail loudly if a test accidentally tries to cross one of those boundaries.

---

## Adding or updating tests

When adding tests:
1. Decide whether the target is Tier 1, 2, or 3.
2. Put the test next to the code it covers.
3. Reuse the shared mocks for Pi imports.
4. If a mock is missing an export, add the smallest possible version to `extensions/__mocks__/`.
5. Run `bun run test`.

If you are unsure about style, follow a nearby test file in the same extension.

---

## Coverage

Coverage is available through `bun run test:coverage`, but it is a diagnostic tool, not a hard gate.

If testing follow-up work is needed, track it in GitHub or attach it to a spec/exec plan when the work is genuinely complex.
