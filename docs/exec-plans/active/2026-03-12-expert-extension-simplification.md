# Expert Extension Simplification

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

This plan conforms to `skills/plan/PLAN.md`.

Status: Active
Owner: agent
Created: 2026-03-12
Spec: [[docs/specs/2026-03-12-expert-extension-simplification.md]]

## Purpose / Big picture

Strip the expert extension down to its essential value: domain-scoped persistent context files that the agent can read on demand and append insights to surgically. Remove the LLM reflection pipeline, auto-injection heuristics, and heavy tool description. The result should feel like the skills system — a menu of available expertise that loads only when needed.

After this change:
- Starting a conversation should have near-zero overhead from the expert extension (just a compact domain listing)
- The agent can still read and update expertise when relevant
- No LLM subprocess calls happen for reflection/routing
- Pinning still works for users who want persistent injection

## Progress

- [x] (2026-03-12) Milestone 1: Delete dead code (reflection pipeline, router, LLM helper)
- [x] (2026-03-12) Milestone 2: Clean remaining files (constants, types, helpers, storage)
- [x] (2026-03-12) Milestone 3: Rewrite hooks (lightweight listing replaces auto-injection)
- [x] (2026-03-12) Milestone 4: Rewrite tool (add append, remove reflect, slim description)
- [x] (2026-03-12) Milestone 5: Rewrite index (remove reflect/log commands)
- [x] (2026-03-12) Milestone 6: Update tests
- [x] (2026-03-12) Milestone 7: Verify end-to-end

## Surprises & Discoveries

- Kept `CONTENT_PRINCIPLES` in constants.ts — it's still used in the tool description and is referenced from the system prompt template. The spec said to strip it from the tool description but the principles are still valuable guidance for the agent when using `update`/`append`.
- The message renderer needed a new branch for the "no pinned domains" case — when only the listing is injected, the loaded message has zero domain details but still has a content string to display.

## Decision Log

- Decision: Remove reflection entirely rather than making it lighter-weight.
  Rationale: The reflection pipeline's core problem isn't performance — it's that LLM-driven rewrites of expertise files produce low-signal updates that corrupt the long-lived mental model. A simpler `append` action gives the agent control without risking existing content.
  Date: 2026-03-12

- Decision: Replace auto-injection with a lightweight domain listing (skills-like awareness).
  Rationale: Auto-injection via heuristic matching adds context cost every turn with unreliable accuracy. A listing costs ~10-20 tokens per domain and lets the agent decide what to read.
  Date: 2026-03-12

- Decision: Keep pinned injection unchanged.
  Rationale: Pinning is user-explicit — the cost is intentional and controlled.
  Date: 2026-03-12

## Outcomes & Retrospective

All 7 milestones complete. `bun run check` passes (498 tests). Summary of changes:

**Deleted** (5 files):
- `reflection.ts`, `router.ts`, `llm.ts` — entire LLM reflection pipeline
- `__tests__/reflection.test.ts`, `__tests__/router.test.ts`

**Simplified** (6 files):
- `constants.ts` — removed `REFLECTIONS_LOG_NAME`, `DEFAULT/MAX_REFLECTION_LOG_LIMIT`, `REFLECTION_PROMPT`, `auto_inject`/`reflection_model` from defaults
- `types.ts` — removed `RouterResult`, `PipelineResult`, `ReflectionLogEntry`, `ExpertiseSettings.auto_inject`/`reflection_model`; replaced `reflect` action with `append`; added `section` param
- `helpers.ts` — removed all matching/formatting functions (~300 lines); kept only `validate_domain_name` and `scan_scope_paths`
- `storage.ts` — removed reflection log functions/schemas, `auto_inject`/`reflection_model` from settings; added `append_to_section`
- `hooks.ts` — replaced auto-injection heuristics with compact domain listing; removed `session_domains` tracking; simplified status to pinned-only
- `tool.ts` — replaced `reflect` case with `append` case; added renderer for append results
- `index.ts` — removed `/expert reflect`, `/expert log` commands and their parsers; removed reflection imports

**Net result**: ~600 lines of code removed. No LLM subprocess calls. Domain listing costs ~10-20 tokens per domain instead of 300-1000+ per injected domain.

## Context and orientation

All work is in `extensions/expert/`. See the spec for the full file-by-file change map.

Key files to understand before starting:
- `hooks.ts` — the injection hot path (most complex changes)
- `tool.ts` — tool registration and action handlers
- `index.ts` — command registration and entrypoint
- `storage.ts` — file I/O, needs new `append_to_section` helper

Files to delete outright:
- `reflection.ts`, `router.ts`, `llm.ts`
- `__tests__/reflection.test.ts`, `__tests__/router.test.ts`

## Plan of work

### Milestone 1: Delete dead code
Delete `reflection.ts`, `router.ts`, `llm.ts` and their test files. These are self-contained — no other file should import from them after the later milestones.

### Milestone 2: Clean remaining files
- `constants.ts`: remove `REFLECTION_PROMPT`, `CONTENT_PRINCIPLES`, `REFLECTIONS_LOG_NAME`, `DEFAULT_REFLECTION_LOG_LIMIT`, `MAX_REFLECTION_LOG_LIMIT`
- `types.ts`: remove `RouterResult`, `PipelineResult`, `ReflectionLogEntry` types; change `ExpertiseAction` to replace `reflect` with `append`; add `section` param to `ExpertiseParams`; remove `reflection_model` from `ExpertiseSettings`
- `helpers.ts`: remove `match_domains_to_prompt`, `DomainMatch`, `MIN_DOMAIN_MATCH_SCORE`, `match_files_to_domains`, `extract_modified_files`, `format_conversation_for_reflection`, `format_conversation_for_router`, `file_matches_scope`, `extract_tool_file_path`, `summarize_text`, `extract_tool_call_summaries`, `extract_text_content` — keep `validate_domain_name`, `scan_scope_paths`, glob utilities
- `storage.ts`: remove `append_reflection_log`, `read_reflection_log`, `ReflectionLogReadResult`, reflection log schema; remove `reflection_model` from settings schema and defaults; add `append_to_section` function

### Milestone 3: Rewrite hooks
In `hooks.ts`:
- Remove the auto-injection matching logic from `before_agent_start`
- Replace with: list domains → build compact listing → append to system prompt
- Pinned domains still inject full YAML (unchanged)
- Remove `session_domains` tracking (no more auto-matched domains)
- Simplify `restore_status` (only pinned domains)
- Context threshold logic still applies to pinned injection

### Milestone 4: Rewrite tool
In `tool.ts`:
- Remove `reflect` case from switch
- Add `append` case: read YAML → find/create section → append item → write back
- Slim down tool description (remove CONTENT_PRINCIPLES blob)
- Update `renderCall` and `renderResult` for new actions

### Milestone 5: Rewrite index
In `index.ts`:
- Remove `/expert reflect` subcommand and handler
- Remove `/expert log` subcommand and handler
- Remove `parse_log_args` function
- Remove imports for reflection pipeline, reflection log reader, settings reader (if no longer needed in commands)
- Update `getArgumentCompletions` to remove `reflect` and `log`

### Milestone 6: Update tests
- Delete `__tests__/reflection.test.ts` and `__tests__/router.test.ts`
- Update `__tests__/helpers.test.ts`: remove tests for deleted functions
- Update `__tests__/storage.test.ts`: remove reflection log tests, add tests for `append_to_section`
- Add tests for `append` tool action if not covered

### Milestone 7: Verify end-to-end
- `bun run check` passes
- Existing `.pi/expertise/*.yaml` files still load
- Domain listing appears in system prompt
- Pinning works
- `append` works
- No reflection/router code remains

## Validation and acceptance

1. `bun run check` passes (lint + typecheck + tests)
2. Start pi in a repo with expertise files — domain listing appears in system prompt without full YAML injection
3. `/expert chat` → pin a domain → next turn shows pinned YAML in system prompt
4. Agent can call `expertise append my-domain gotchas "some insight"` and the YAML file updates correctly
5. No `pi -p` subprocesses spawn during normal usage
6. Grep for `reflection`, `router`, `run_completion` in `extensions/expert/` — no references remain (except potentially in README docs)

## Idempotence and recovery

Each milestone is independently committable. If something goes wrong mid-way:
- Milestones 1-2 (deletions/cleanups) may cause temporary import errors — that's expected until milestones 3-5 update the importers
- The safest order is: delete files first, then fix all importers in one pass

## Artifacts and notes

- Current behavior documented in `.pi/tracks/expert-extension-rework/current-behavior.md`
- Spec at `docs/specs/2026-03-12-expert-extension-simplification.md`

## Interfaces and dependencies

After completion, the `expertise` tool exposes:
- Actions: `list`, `get`, `init`, `update`, `append`, `delete`
- New `append` params: `domain` (string), `section` (string), `content` (string)
- No external LLM calls — everything is file I/O
