# Expert Extension Review & Cleanup Report

**Scope**: Full review + implementation of `extensions/expert/` (8 source files, 4 test files)
**Status**: All review findings resolved. Manual E2E verification passed.

---

## What was done

### Spec compliance — all gaps closed

| Spec requirement | Status |
|---|---|
| Delete dead code (reflection.ts, router.ts, llm.ts) | ✅ Done (prior session) |
| Clean constants.ts, types.ts, helpers.ts, storage.ts | ✅ Done |
| Strip CONTENT_PRINCIPLES from tool description | ✅ Done (~400 tokens/conversation saved) |
| Remove dead CONTENT_PRINCIPLES constant | ✅ Done (constants.ts: 45 → 11 lines) |
| Add `append` action | ✅ Done |
| Remove `reflect` action | ✅ Done |
| Lightweight domain listing | ✅ Done |
| Keep pinned injection | ✅ Done |
| Slim tool description (§4.3) | ✅ Done |
| Remove `/expert reflect` and `/expert log` | ✅ Done |

### Code quality fixes

| Fix | Impact |
|---|---|
| Replaced `existsSync` with try/catch | 6 call sites — eliminates TOCTOU races |
| Hoisted `is_ignored_dir` Set to module level | No allocation per call |
| Trimmed `init` response | 20-line instruction wall → 2 sentences |
| Documented YAML roundtrip in README | "Known Limitations" section added |
| Extracted `parse_init_args` + `tokenize_command_args` to helpers.ts | index.ts: 355 → 265 lines |

### UX improvement

| Change | Before | After |
|---|---|---|
| `/expert chat` toggle UI | SettingsList with "on"/"off" text on right side | Custom toggle list with ○/● circles on left + cursor |

### Test coverage

| Metric | Before | After |
|---|---|---|
| Test files | 2 | 4 |
| Tests | 36 | 110 |
| Expect calls | 56 | 196 |
| Files with tests | helpers, storage | helpers, storage, hooks, tool |
| Coverage (by file) | ~24% | ~80% (index.ts renderers/commands remain untested — need pi API integration tests) |

### Final line counts

| File | Lines |
|---|---|
| constants.ts | 11 |
| helpers.ts | 173 |
| hooks.ts | 193 |
| index.ts | 265 |
| storage.ts | 281 |
| tool.ts | 302 |
| types.ts | 95 |
| **Source total** | **1320** |
| helpers.test.ts | 220 |
| storage.test.ts | 319 |
| hooks.test.ts | 483 |
| tool.test.ts | 408 |
| **Test total** | **1430** |

---

## Remaining (not blocking)

- `any` types on tool execute/render — pi extension API limitation (todos extension uses same pattern)
- index.ts command handler + message renderers untested — need pi API mocks for integration tests
- Append deduplication — acceptable for now, agent expected to be smart
- index.ts size (265 lines) — comfortable, no split needed currently

## E2E verification results

- ✅ Domain listing injection
- ✅ `/expert chat` — toggle UI with ○/● circles
- ✅ Pinning + status bar
- ✅ `/expert chat clear` — status bar cleared
- ✅ `/expert list`
- ✅ `/expert init`
- ✅ `expertise delete`
