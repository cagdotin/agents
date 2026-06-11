# Shared Test Mocks

This directory contains mock implementations of Pi peer dependencies (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `@earendil-works/pi-ai`) used by Vitest for unit testing.

## How It Works

The `vitest.config.ts` at the repository root aliases all `@earendil-works/*` imports to these mock files at the module resolution level. This means test files import from the real package paths, but Vitest resolves them to these lightweight stubs.

## Files

- **`pi-coding-agent.ts`** — Mocks `isToolCallEventType`, `getAgentDir`, `keyHint`, and type exports
- **`pi-tui.ts`** — Mocks `fuzzyMatch`, `visibleWidth`, `truncateToWidth`
- **`pi-ai.ts`** — Mocks `StringEnum`, `complete` (throws by default), and type exports

## Conventions

- Each mock exports only the minimum surface needed by Tier 1 and Tier 2 tests
- `complete()` throws by default to prevent accidental real LLM calls — override per-test with `vi.mocked()`
- When a test fails with a missing export, add it to the appropriate mock file here
- These are **not** Pi extensions — they exist solely for test infrastructure
