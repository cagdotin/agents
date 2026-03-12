# Tasks

## Current milestone: Implementation ✅

Spec: `docs/specs/2026-03-12-expert-extension-simplification.md`
Exec plan: `docs/exec-plans/active/2026-03-12-expert-extension-simplification.md`

### Implementation sequence (all complete)

1. [x] Delete dead code (reflection.ts, router.ts, llm.ts + their tests)
2. [x] Clean constants.ts, types.ts, helpers.ts, storage.ts
3. [x] Rewrite hooks.ts (lightweight listing replaces auto-injection)
4. [x] Rewrite tool.ts (add append, remove reflect, slim description)
5. [x] Rewrite index.ts (remove reflect/log commands)
6. [x] Update remaining tests

### Post-review cleanup (all complete)

- [x] Strip CONTENT_PRINCIPLES from tool description (~400 tokens saved)
- [x] Remove dead CONTENT_PRINCIPLES constant from constants.ts
- [x] Hoist is_ignored_dir Set to module-level constant
- [x] Trim init response instruction wall (20 lines → 2 sentences)
- [x] Document YAML roundtrip reformatting in README (Known Limitations)
- [x] Replace existsSync with try/catch in storage.ts and helpers.ts (6 call sites)
- [x] Extract parse_init_args + tokenize_command_args from index.ts to helpers.ts
- [x] Add tests for parse_init_args (9 cases) and tokenize_command_args (6 cases)
- [x] Add tests for hooks.ts (22 tests: injection, pinning, thresholds, session rebuild)
- [x] Add tests for tool.ts (36 tests: all 6 actions + renderCall + renderResult)
- [x] Replace SettingsList with custom toggle list (○/● circles on left)
- [x] End-to-end verification (manual)

## Future considerations

- Pruning story for append-only expertise files (not urgent — better than LLM rewrites corrupting content)
- Whether domain listing should include scope paths or just name + description
- Whether to add a `/expert read <domain>` command shortcut
