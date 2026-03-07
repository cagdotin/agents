# Vitest Testing Infrastructure

Status: Implemented (Phase 1–3 complete)
Date: 2026-03-07

## 1. Problem Statement

This repository has ~6,100 lines of TypeScript across 5 extensions and 1 validation script with **zero automated tests**. As the project grows with new extensions and workflows, regressions become increasingly likely — especially in pure-logic modules like path matching, policy evaluation, domain scoring, frontmatter parsing, and LLM output parsing.

The codebase has significant testable surface area that requires no Pi runtime at all (Tier 1), a second tier that uses Pi types but whose logic is extractable, and a third tier deeply coupled to the Pi runtime. A testing strategy needs to address all three tiers with appropriate trade-offs.

Desired end state:
- Vitest is the test runner, invoked via `bun run test`.
- Tier 1 (pure logic) has comprehensive unit tests with high coverage.
- Tier 2 (Pi types + LLM) has tests using mocked Pi imports and stubbed LLM calls.
- Tier 3 (Pi runtime integration) is explicitly deferred with a documented future path.
- Tests run in `bun run check` and are enforced by the Lefthook pre-commit hook.

> **Important boundary:** This spec covers test infrastructure setup and the first wave of unit tests (Tier 1 + Tier 2). It does NOT cover TUI component testing, end-to-end session replay, or visual regression testing — those are explicitly deferred to a future spec.

## 2. Goals and Non-Goals

### 2.1 Goals

- Install and configure Vitest as a dev dependency, runnable via Bun.
- Establish test file conventions, directory structure, and naming patterns.
- Write unit tests for all Tier 1 modules (pure logic, no Pi dependency).
- Write unit tests for Tier 2 modules with mocked Pi imports.
- Integrate `bun run test` into the `bun run check` aggregate gate.
- Achieve meaningful coverage on the highest-risk modules (matchers, policy evaluation, parsers, validators).

### 2.2 Non-Goals

- TUI component snapshot testing (future spec).
- End-to-end session replay or tool-call sequence testing (future spec).
- Coverage enforcement thresholds in CI (premature — revisit after baseline is established).
- Testing `index.ts` extension registration files (Tier 3 — tightly coupled to Pi runtime).
- Testing `expert/llm.ts` which spawns `pi -p` subprocess (integration test, not unit).

## 3. System Context

### 3.1 Testability Tiers

The codebase naturally separates into three testability tiers based on Pi runtime coupling:

#### Tier 1 — Pure Logic (no Pi imports)

These modules have zero `@mariozechner/*` imports. They can be tested directly with no mocks.

| Module | Lines | What to Test |
|--------|------:|--------------|
| `damage-control/matcher.ts` | 147 | Path normalization, glob→regex, path rule matching, command detection (delete/mutation patterns), home expansion |
| `damage-control/types.ts` | 88 | Type-only — no runtime tests needed |
| `expert/helpers.ts` | 519 | Domain name validation, prompt-to-domain scoring, file-to-domain matching, glob compilation, conversation formatting, file extraction |
| `expert/reflection.ts` | 226 | Reflection output parsing (`parse_reflection_output`), reflection input building |
| `expert/router.ts` | 131 | Router result XML parsing (extractable), prompt construction |
| `expert/storage.ts` | 314 | YAML read/write, directory operations, domain listing, settings loading, reflection log append |
| `todos/helpers.ts` | 138 | ID normalization/validation, status checks, sorting, search text building, todo filtering (note: `filter_todos` uses `fuzzyMatch` from pi-tui — mock needed) |
| `todos/storage.ts` | 667 | Frontmatter serialize/parse, split_front_matter, JSON→YAML migration, todo file read/write, listing, garbage collection, settings |
| `todos/formatting.ts` | 156 | Assignment suffix, heading, list formatting |
| `answer/extraction.ts` | 100 | JSON parsing (`parse_extraction_result`), model selection logic |
| `scripts/validate-docs.ts` | 207 | Frontmatter extraction, field parsing, validation rules |

#### Tier 2 — Uses Pi Types, Logic Extractable

These import from `@mariozechner/pi-coding-agent` or `@mariozechner/pi-ai` for types/utilities, but the core logic is conditional matching or data transformation that can be tested with mocked imports.

| Module | Pi Imports Used | Mock Strategy |
|--------|----------------|---------------|
| `damage-control/policy.ts` | `isToolCallEventType`, `ToolCallEvent` | Mock `isToolCallEventType` as a simple string comparator; fabricate `ToolCallEvent` objects with the fields the code actually reads (`input.command`, `input.path`, etc.) |
| `damage-control/rules-loader.ts` | `getAgentDir` | Mock to return a temp directory |
| `answer/extraction.ts` | `complete`, `Model`, `Api`, `UserMessage` | Mock `complete` to return canned responses; test `parse_extraction_result` and `select_extraction_model` independently |
| `todos/helpers.ts` | `fuzzyMatch` (from pi-tui) | Mock to return `{ matches: true/false, score: N }` — test the filter/sort logic, not fuzzy matching itself |
| `todos/formatting.ts` | `keyHint`, `Theme` (from pi-coding-agent) | Mock `keyHint` to return plain strings; only used for display formatting |
| `todos/storage.ts` | `ExtensionContext` (type only for `acquire_lock`) | Lock-related functions need `ctx` — test non-locking functions directly, defer lock tests |

#### Tier 3 — Deep Pi Runtime (deferred)

These are tightly coupled to Pi's extension lifecycle, session management, TUI rendering, or subprocess spawning.

| Module | Why Deferred |
|--------|-------------|
| All `index.ts` files | Extension registration, hook wiring, lifecycle callbacks |
| `*/command.ts` | Slash command handlers using Pi's command API |
| `*/components/*.ts` | TUI components using `@mariozechner/pi-tui` rendering primitives |
| `expert/llm.ts` | Spawns `pi -p` subprocess — integration test territory |
| `expert/hooks.ts` | `before_agent_start` hook with Pi session/context access |

**Future path for Tier 3:** When Pi provides a test harness or we build a mock session/context factory, these become testable. The TUI components are candidates for snapshot testing once we establish a render-to-string pattern.

### 3.2 Dependencies Map

```
@mariozechner/pi-coding-agent  →  20 imports across 13 files
  Key exports used: isToolCallEventType, ToolCallEvent, ExtensionContext,
                    StringEnum, getAgentDir, keyHint, Theme, getEditorKeybindings,
                    getMarkdownTheme, getSettingsListTheme, copyToClipboard

@mariozechner/pi-ai            →  3 imports across 3 files
  Key exports used: complete, Model, Api, UserMessage, StringEnum

@mariozechner/pi-tui           →  9 imports across 9 files
  Key exports used: fuzzyMatch, Box, Text, Container, Markdown, SelectList,
                    SettingsList, DynamicBorder, BorderedLoader, visibleWidth,
                    truncateToWidth
```

For Tier 2 testing, we only need to mock a small subset: `isToolCallEventType`, `getAgentDir`, `fuzzyMatch`, `keyHint`, `complete`.

## 4. Domain Model

### 4.1 Test File Convention

```
extensions/<name>/__tests__/<module>.test.ts
scripts/__tests__/<script>.test.ts
```

Co-located `__tests__` directories within each extension. This keeps tests close to source while remaining visually distinct. Vitest discovers them automatically via glob patterns.

### 4.2 Test Fixture Convention

```
extensions/<name>/__tests__/fixtures/
```

Static test data (sample YAML files, rule files, todo markdown files, frontmatter samples) lives in `fixtures/` subdirectories. For filesystem-dependent tests, use `os.tmpdir()` with per-test isolation.

### 4.3 Mock Convention

```
extensions/__mocks__/
  pi-coding-agent.ts    # shared mock for @mariozechner/pi-coding-agent
  pi-tui.ts             # shared mock for @mariozechner/pi-tui
  pi-ai.ts              # shared mock for @mariozechner/pi-ai
```

Shared mocks at the `extensions/` level, reusable across all extension test suites. Each mock exports the minimum surface needed by tests, not the full package API. Individual tests can override specific mock behavior with `vi.mocked()`.

## 5. Detailed Design

### 5.1 Vitest Configuration

A single `vitest.config.ts` at the repository root:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "extensions/**/__tests__/**/*.test.ts",
      "scripts/__tests__/**/*.test.ts",
    ],
    alias: {
      "@mariozechner/pi-coding-agent": "./extensions/__mocks__/pi-coding-agent.ts",
      "@mariozechner/pi-tui": "./extensions/__mocks__/pi-tui.ts",
      "@mariozechner/pi-ai": "./extensions/__mocks__/pi-ai.ts",
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
```

The `alias` approach replaces Pi peer dependencies with lightweight mocks at the module resolution level. This is cleaner than `vi.mock()` per-file for peer deps that are mocked the same way everywhere.

### 5.2 Shared Mocks

#### `extensions/__mocks__/pi-coding-agent.ts`

```ts
// Minimal mock — only exports used in testable (Tier 1+2) modules

export function isToolCallEventType(type: string, event: { toolName?: string }): boolean {
  return event.toolName === type;
}

export function getAgentDir(): string {
  return "/tmp/mock-agent-dir";
}

export function keyHint(key: string): string {
  return `[${key}]`;
}

// Type re-exports (no-op at runtime, TypeScript handles these)
export type ToolCallEvent = {
  toolName: string;
  input: Record<string, any>;
};

export type ExtensionContext = {
  sessionManager: {
    getSessionId: () => string;
    getSessionFile: () => string;
  };
  hasUI: boolean;
  ui: {
    confirm: (title: string, message: string) => Promise<boolean>;
  };
};

export type Theme = Record<string, any>;
```

#### `extensions/__mocks__/pi-tui.ts`

```ts
export function fuzzyMatch(pattern: string, text: string): { matches: boolean; score: number } {
  const lower_pattern = pattern.toLowerCase();
  const lower_text = text.toLowerCase();
  const matches = lower_text.includes(lower_pattern);
  return { matches, score: matches ? lower_pattern.length : 0 };
}

export function visibleWidth(text: string): number {
  return text.length;
}

export function truncateToWidth(text: string, width: number): string {
  return text.length <= width ? text : text.slice(0, width - 1) + "…";
}
```

#### `extensions/__mocks__/pi-ai.ts`

```ts
export function StringEnum<T extends readonly string[]>(values: T) {
  return { type: "string", enum: values };
}

export const Type = {
  Object: (schema: any) => schema,
  Optional: (schema: any) => schema,
  String: (opts?: any) => ({ type: "string", ...opts }),
  Array: (item: any, opts?: any) => ({ type: "array", items: item, ...opts }),
};

export async function complete() {
  throw new Error("complete() must be mocked per-test");
}

export type Api = any;
export type Model<T> = { provider: string; id: string };
export type UserMessage = { role: "user"; content: any[]; timestamp: number };
```

### 5.3 Test Plan by Module

#### damage-control/matcher.ts — `matcher.test.ts`

High-value, pure-logic, zero dependencies. **Priority: P0.**

| Test Group | Cases |
|------------|-------|
| `normalize_path` | Forward slashes, backslashes, mixed, empty string |
| `expand_home` | `~`, `~/path`, absolute path passthrough, relative path passthrough |
| `path_rule_matches_target` — exact paths | Absolute match, relative match, basename-only match, no match |
| `path_rule_matches_target` — directory rules | Trailing slash matches children, matches exact dir, doesn't match siblings |
| `path_rule_matches_target` — glob rules | `*` single segment, `**` multi-segment, `?` single char, mixed patterns |
| `command_mentions_path_rule` | Path substring in command, basename match, resolved absolute match, minimum length threshold (< 3 chars skipped) |
| `is_bash_delete_operation` | Each DELETE_COMMAND_PATTERN keyword, negative cases |
| `is_bash_mutation_operation` | Each MUTATION_COMMAND_PATTERN keyword, includes delete operations, negative cases |
| `truncate_preview` | Under limit, at limit, over limit with ellipsis, multi-line collapse |

#### damage-control/policy.ts — `policy.test.ts`

Tests tool call evaluation against rule sets. Requires Pi type mocks. **Priority: P0.**

| Test Group | Cases |
|------------|-------|
| `evaluate_tool_call` — read/write/edit | Zero-access path blocked, read-only path blocks write/edit, read-only path allows read, no-match passes through |
| `evaluate_tool_call` — bash | Zero-access path mention blocked, mutation of read-only path blocked, delete of no-delete path blocked, safe command passes through |
| `evaluate_tool_call` — bash patterns | Block action returns blocked=true, ask action returns confirmation_required=true, pattern match, pattern miss |
| `evaluate_tool_call` — grep/find/ls | Correct candidate path extraction, zero-access check on search paths |
| `evaluate_tool_call` — unknown tools | Custom input.path extraction, input.paths array extraction, no paths = passthrough |
| Edge cases | Empty rules (everything passes), overlapping rules (first match wins), empty command string |

#### damage-control/rules-loader.ts — `rules-loader.test.ts`

Filesystem-dependent — uses temp directories with fixture YAML files. **Priority: P1.**

| Test Group | Cases |
|------------|-------|
| `load_rules` | Bundled rules loaded, missing global/project files skipped gracefully, all three sources merged |
| Rule parsing | Valid YAML parsed, invalid YAML produces warning, unknown keys produce warning |
| Bash pattern normalization | Valid rule compiled, missing pattern rejected, missing reason rejected, invalid regex rejected, ask vs block action |
| Path rule normalization | String array normalized, non-string values rejected, empty strings rejected |
| Deduplication | Duplicate signatures across sources deduplicated |
| Source discovery | Project rules found in cwd, found in ancestor, stops at git root, returns undefined when none found |

#### expert/helpers.ts — `helpers.test.ts`

Large module with multiple distinct concerns. **Priority: P0.**

| Test Group | Cases |
|------------|-------|
| `validate_domain_name` | Valid names (lowercase, hyphens), invalid (uppercase, spaces, special chars), empty string |
| `match_domains_to_prompt` | Domain name exact match (+10), alias match (+8), keyword match (+4), description word match (+2), scope path match (+8), scope pattern match (+6), below threshold filtered out, multi-domain ranking |
| `match_files_to_domains` | File under scope path matches, file outside scope path skipped, glob pattern match, multiple files across domains |
| `file_matches_scope` | Direct path match, subdirectory match, pattern match, no match |
| `extract_modified_files` | Write tool calls extracted, edit tool calls extracted, assistant content tool_use blocks extracted, duplicates deduplicated, non-write tools ignored |
| `format_conversation_for_reflection` | User messages formatted, assistant messages formatted, tool results included, scope filtering applied, long tool results truncated |
| `format_conversation_for_router` | User messages included, assistant summarized (head+tail), tool calls as one-liners, tool results excluded |
| `scan_scope_paths` | Files listed, directories walked, max depth respected, ignored dirs skipped, missing paths skipped |

#### expert/reflection.ts — `reflection.test.ts`

Parser and input builder are pure; `run_reflection` and pipeline need mocked storage + LLM. **Priority: P1.**

| Test Group | Cases |
|------------|-------|
| `parse_reflection_output` | Both XML tags present, missing updated_expertise → null, missing summary → fallback message, extra whitespace handling |
| Input building (via reflection) | Current expertise + conversation assembled, router points section included when provided, omitted when not |

#### expert/storage.ts — `storage.test.ts`

Filesystem I/O — uses temp directories. **Priority: P1.**

| Test Group | Cases |
|------------|-------|
| `get_expertise_dir` | Default `.pi/expertise` path, env override path |
| `read_expertise` / `write_expertise` | Round-trip write→read, YAML header parsed correctly, missing file returns null |
| `list_domains` | Multiple domains listed, empty directory returns [], non-YAML files ignored |
| `read_settings` / `write_settings` | Default settings when file missing, valid settings parsed, partial settings filled with defaults |
| `append_reflection_log` | Entry appended to new file, entry appended to existing file |

#### todos/helpers.ts — `helpers.test.ts`

**Priority: P0.**

| Test Group | Cases |
|------------|-------|
| `format_todo_id` / `normalize_todo_id` | Prefix added, prefix stripped, `#` prefix stripped, case normalization |
| `validate_todo_id` | Valid hex IDs, invalid formats, empty string |
| `is_todo_closed` | "closed" → true, "done" → true, "open" → false, case insensitive |
| `sort_todos` | Closed after open, assigned before unassigned (within open), chronological tiebreak |
| `filter_todos` | Empty query returns all, single token filters, multi-token AND filtering, fuzzy match scoring |
| `split_todos_by_assignment` | Correct bucketing into assigned/open/closed |
| `build_refine_prompt` | Correct ID and title interpolation |

#### todos/storage.ts — `storage.test.ts`

Large module. Filesystem-dependent. **Priority: P1.**

| Test Group | Cases |
|------------|-------|
| Frontmatter serialization | Round-trip serialize→parse, special characters quoted, empty tags as `[]`, multiline handling |
| `split_front_matter` | YAML frontmatter extracted, JSON frontmatter migrated, no frontmatter returns empty + full body |
| `parse_frontmatter` | All fields parsed, missing fields get defaults, inline array, multiline array |
| `read_todo_file` / `write_todo_file` | Round-trip, body preserved, trimming behavior |
| `generate_todo_id` | Returns 8-char hex, unique across existing files |
| `list_todos` | Multiple todos listed and sorted, empty dir returns [], non-md files ignored |
| `garbage_collect_todos` | Closed todos older than cutoff deleted, open todos preserved, gc disabled = no-op |
| Settings | Default settings when file missing, valid JSON parsed, invalid JSON returns defaults |

#### answer/extraction.ts — `extraction.test.ts`

**Priority: P1.**

| Test Group | Cases |
|------------|-------|
| `parse_extraction_result` | Valid JSON parsed, markdown-fenced JSON parsed, invalid JSON returns null, missing questions array returns null |
| `select_extraction_model` | Codex preferred when available, Haiku fallback, current model fallback when no API keys |

#### scripts/validate-docs.ts — `validate-docs.test.ts`

Runs against fixture directories. **Priority: P2.**

| Test Group | Cases |
|------------|-------|
| Resource validation | Missing frontmatter detected, missing required fields detected, invalid URL detected, invalid date format detected |
| Skill validation | Missing SKILL.md detected, name mismatch detected |
| Extension README validation | Missing README detected, too-short README detected, insufficient headings detected |

### 5.4 Filesystem Test Isolation

For modules that do file I/O (storage, rules-loader, validate-docs), each test suite creates an isolated temp directory:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";

let tmp_dir: string;

beforeAll(async () => {
  tmp_dir = await mkdtemp(path.join(os.tmpdir(), "test-"));
});

afterAll(async () => {
  await rm(tmp_dir, { recursive: true, force: true });
});
```

Each test within a suite uses a unique subdirectory of `tmp_dir` to avoid cross-test contamination.

### 5.5 Package.json Script Integration

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "check": "bun run check:biome && bun run check:docs && bun run test"
  }
}
```

`bun run test` invokes Vitest in run mode (single pass, exit).
`bun run test:watch` for development with hot reload.
`bun run test:coverage` for ad-hoc coverage inspection.
`bun run check` becomes the full quality gate: lint + docs + tests.

### 5.6 Lefthook Integration

`lefthook.yml` was updated to run all three quality gates in parallel:

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: bun run check:biome
    docs:
      run: bun run check:docs
    test:
      run: bun run test
```

This is faster than the sequential `bun run check` and provides clearer error attribution when a specific gate fails.

## 6. Error Handling and Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Pi mock is incomplete (missing export) | TypeScript compilation error in test file | Add the missing export to the shared mock in `extensions/__mocks__/` |
| Temp directory cleanup fails | `afterAll` throws (non-fatal in most runners) | `os.tmpdir()` is ephemeral; OS cleans up eventually. Log warning but don't fail the suite. |
| Vitest can't resolve Pi peer deps | Import error at test startup | Verify `alias` config in `vitest.config.ts` maps all three `@mariozechner/*` packages |
| Test discovers a real bug | Test failure | Fix the bug — that's the point |
| Flaky filesystem test (race condition) | Intermittent failure | Ensure per-test subdirectory isolation; never share state between tests |

## 7. Security and Safety Considerations

- Tests must never write outside `os.tmpdir()`.
- Tests must never spawn real `pi` processes or make real LLM API calls.
- The `complete()` mock throws by default to catch accidental real calls.
- No secrets, API keys, or real file paths in test fixtures.

## 8. Testing Strategy

This spec *is* the testing strategy. Meta-testing notes:

- The Vitest config itself is validated by running `bun run test` with at least one test file.
- Mock completeness is validated by TypeScript — if a test imports a function that the mock doesn't export, compilation fails.
- Coverage is inspected manually in the first iteration; thresholds are set once a baseline exists.

## 9. Implementation Checklist

Ordered by suggested implementation sequence. Each step should be independently committable.

### Phase 1: Infrastructure

- [x] Install Vitest: `bun add -d vitest`
- [x] Create `vitest.config.ts` at repo root
- [x] Create shared mocks: `extensions/__mocks__/pi-coding-agent.ts`, `pi-tui.ts`, `pi-ai.ts`
- [x] Add scripts to `package.json`: `test`, `test:watch`, `test:coverage`
- [x] Update `check` script to include `bun run test`
- [x] Add one smoke test (e.g., `damage-control/matcher.test.ts` with 2-3 cases) to validate the full pipeline works
- [x] Verify `bun run check` passes end-to-end (Lefthook integration)

### Phase 2: Tier 1 — Pure Logic Tests (P0)

- [x] `extensions/damage-control/__tests__/matcher.test.ts` — full suite (53 tests)
- [x] `extensions/damage-control/__tests__/policy.test.ts` — full suite with Pi mock (25 tests)
- [x] `extensions/expert/__tests__/helpers.test.ts` — full suite (45 tests)
- [x] `extensions/todos/__tests__/helpers.test.ts` — full suite (28 tests)

### Phase 3: Tier 1 — Filesystem + Parser Tests (P1)

- [x] `extensions/damage-control/__tests__/rules-loader.test.ts` — with temp dirs + fixture YAML (13 tests)
- [x] `extensions/expert/__tests__/reflection.test.ts` — parser tests (7 tests)
- [x] `extensions/expert/__tests__/router.test.ts` — parser + builder tests (8 tests)
- [x] `extensions/expert/__tests__/storage.test.ts` — with temp dirs (21 tests)
- [x] `extensions/todos/__tests__/storage.test.ts` — with temp dirs (24 tests)
- [x] `extensions/todos/__tests__/formatting.test.ts` — plain text formatting (11 tests)
- [x] `extensions/answer/__tests__/extraction.test.ts` — parser + model selection (11 tests)

### Phase 4: Script + Coverage Baseline

- [ ] `scripts/__tests__/validate-docs.test.ts` — with fixture directories
- [ ] Run `bun run test:coverage` and record baseline numbers in `QUALITY.md`
- [ ] Decide on coverage thresholds (if any) for future enforcement

### Phase 5: Documentation

- [ ] Update `docs/ARCHITECTURE.md` cross-cutting concerns section to mention testing
- [x] Update `QUALITY.md` to reflect testing infrastructure score and code findings
- [ ] Add testing conventions to `docs/CONTRIBUTING-DOCS.md` or create a separate `CONTRIBUTING-CODE.md`

## 10. Open Questions

### 10.1 Coverage Thresholds

**What we know:** Coverage is useful as a diagnostic, not a gate. Chasing 100% produces test bloat.
**What we don't know:** What's a reasonable threshold for this repo?
**Recommended default:** No enforced threshold in Phase 1–3. After Phase 4, set a floor at whatever the measured coverage is (ratchet — it can only go up).

### 10.2 `@sinclair/typebox` Dependency

`expert/types.ts` imports `Type` from `@sinclair/typebox` (via the `StringEnum` wrapper from `pi-ai`). Our `pi-ai` mock re-exports a stub `Type` object. If typebox types are used at runtime in tested code (not just for schema declaration), the mock may need to be more complete.
**Recommended default:** Start with the stub; expand only if a test fails on it.

### 10.3 Integration Test Tier (Future)

When we're ready for Tier 3, the likely approach is:
- A `create_mock_context()` factory that builds a fake `ExtensionContext` with in-memory session, filesystem, and UI stubs.
- A `replay_tool_calls(sequence)` utility that simulates a tool call sequence against an extension's hooks.
- TUI snapshot tests using a render-to-string adapter.

This should be its own spec when the time comes.
