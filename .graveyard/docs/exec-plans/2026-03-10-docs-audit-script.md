# Docs Audit Script — Implementation Plan

Status: Completed
Owner: agent
Created: 2026-03-10
Spec: [[docs/specs/2026-03-10-docs-audit-script.md]]

This ExecPlan is a living document and must be maintained in accordance with `skills/engineering/plan/PLAN.md`.

## Purpose / Big picture

After this work, running `bun run audit` will scan the repository and report documentation drift — extensions missing from the codemap/scorecard, completed plans stuck in `active/`, stale test counts, and outdated timestamps. Errors exit 1 (provably wrong). Advisories exit 0 (need human judgment). The script is invoked deliberately, never in pre-commit or `bun run check`.

Future follow-up (out of scope): a "librarian" sub-agent that periodically invokes this audit and acts on findings.

## Progress

- [x] Milestone 1: Core script with error checks (E1–E6)
- [x] Milestone 2: Advisory checks (A1–A3)
- [x] Milestone 3: Tests
- [x] Milestone 4: Wiring + docs + validation

## Surprises & discoveries

- **Regex vs markdown bold:** The coverage baseline regex initially failed because `**Coverage baseline (...):**` has markdown bold markers `**` between the colon and the numbers. Fixed by using a lenient `.*?` pattern instead of `[^:]*:\s*`.
- **vitest `numTotalTestSuites` counts describe blocks, not files:** In vitest 4.x, `numTotalTestSuites` (107) counts nested describe blocks. Use `testResults.length` (15) for actual file count.
- **`bun run vitest run` vs `bunx vitest run`:** Both work for subprocess invocation. Used `bunx` for clarity.
- **Real drift found immediately:** The tmux-extension-merge plan was in active/ but missing from the exec-plans README index (E6). Test count baseline was also stale (425 → 447).

## Decision log

- Decision: Two severity levels only — error and advisory. No "warning."
  Rationale: "Warning" is ambiguous to agents — they can't tell if it's actionable or informational. Errors are provably wrong and exit 1. Advisories are heuristic flags that exit 0.
  Date/Author: 2026-03-10 / user + agent

- Decision: Separate from `bun run check` — invoked as `bun run audit`.
  Rationale: The audit is heavier (runs vitest, reads git log) and advisory in nature. It should not fill agent context on every commit or block normal development flow.
  Date/Author: 2026-03-10 / user

- Decision: Future "librarian" sub-agent is explicitly out of scope.
  Rationale: User wants periodic automated audits eventually, but the script is the foundation. Sub-agent work is a separate initiative.
  Date/Author: 2026-03-10 / user

## Outcomes & retrospective

- `bun run audit` is operational and catches real drift in the repo
- 13 new tests in `scripts/__tests__/audit-docs.test.ts`, all passing
- `bun run check` passes (447 tests, 16 files)
- Found real issues on first run: tmux-extension-merge missing from index, stale test count baseline
- Script is separate from `bun run check` as designed — on-demand only

## Context and orientation

### Existing validation infrastructure

- `scripts/validate-docs.ts` — checks structural validity (frontmatter, READMEs). Runs in `bun run check` and pre-commit. Uses Zod for boundary validation. Reports errors with file path, message, and hint.
- `scripts/__tests__/validate-docs.test.ts` — temp-dir fixture pattern with `spawnSync` to run the validator as a subprocess. Creates a full mini repo fixture, then asserts on exit code and stderr/stdout.
- `vitest.config.ts` — includes `scripts/__tests__/**/*.test.ts` in the test glob.

### Files the audit reads

| File | What we check |
|---|---|
| `extensions/*/` | Directory existence → cross-ref against ARCHITECTURE, README, QUALITY |
| `docs/ARCHITECTURE.md` | Contains each extension name in the codemap section |
| `README.md` | Contains each extension name in the structure listing |
| `docs/QUALITY.md` | Contains a scorecard row for each extension; test count baseline |
| `docs/exec-plans/active/*.md` | Status field, milestone completion |
| `docs/exec-plans/completed/*.md` | Existence (for index cross-ref) |
| `docs/exec-plans/README.md` | Plan index references match actual files |
| `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/exec-plans/tech-debt-tracker.md` | `Last updated` date vs git history |

### Conventions to follow

- Same `AuditFinding` shape as `ValidationError` in validate-docs but with a `severity` field
- Same hint style: what's wrong, why it matters, how to fix it
- Same `main()` → async function → process.exitCode pattern
- File/folder names: kebab-case. Functions: snake_case. Types: CamelCase.

## Plan of work

### Milestone 1: Core script with error checks

Create `scripts/audit-docs.ts` with the main structure and all six error checks (E1–E6). These are pure filesystem checks — no git or vitest needed.

1. Define `AuditFinding` type and `push_finding` helper
2. Implement `audit_extension_coverage` — scans `extensions/` dirs (skip `__mocks__`), reads ARCHITECTURE.md, README.md, QUALITY.md, checks each extension appears
3. Implement `audit_exec_plan_status` — scans `active/*.md` for `Status: Complete*`
4. Implement `audit_exec_plan_index` — parses README.md wikilinks vs actual files in active/ and completed/
5. Wire into `main()` with error/advisory output formatting and exit code logic

### Milestone 2: Advisory checks

Add the three advisory checks that use external tools or heuristics.

1. `audit_test_count` — run `vitest run --reporter=json`, parse output, compare against QUALITY.md baseline. Graceful skip on failure.
2. `audit_last_updated_dates` — run `git log -1 --format=%aI` for tracked files, compare against documented `Last updated:` header. Graceful skip outside git repos.
3. `audit_milestone_completion` — scan active plans for all-complete milestones.

### Milestone 3: Tests

Create `scripts/__tests__/audit-docs.test.ts` using temp-dir fixtures:

- Clean repo fixture → exit 0, no findings
- Extension dir not in ARCHITECTURE/README/QUALITY → exit 1 with E1/E2/E3
- Completed plan in active/ → exit 1 with E4
- Plan index drift (phantom entry, missing entry) → exit 1 with E5/E6
- All milestones complete in active plan → exit 0 with advisory A3
- Advisory-only output → exit 0

Skip A1 (vitest) and A2 (git dates) in automated tests — they depend on external state. Test them via manual `bun run audit`.

### Milestone 4: Wiring + docs + validation

1. Add `"audit": "bun run scripts/audit-docs.ts"` to package.json
2. Update `docs/CONTRIBUTING-DOCS.md` section 8 to mention the audit script
3. Run `bun run audit` on the real repo — should be clean
4. Run `bun run check` — all tests pass, no regressions

## Concrete steps

Working directory: `/Users/cgn/git/0xcgn/agents`

### Milestone 1

```bash
# Create scripts/audit-docs.ts with error checks E1-E6
# Test manually:
bun run scripts/audit-docs.ts
# Expected: exit 0 if repo is clean (which it should be after our audit commit)
```

### Milestone 2

```bash
# Add advisory checks A1-A3 to scripts/audit-docs.ts
# Test manually:
bun run scripts/audit-docs.ts
```

### Milestone 3

```bash
# Create scripts/__tests__/audit-docs.test.ts
bun test scripts
# Expected: all new + existing validate-docs tests pass
```

### Milestone 4

```bash
# Add audit script to package.json
# Update CONTRIBUTING-DOCS.md
bun run audit
bun run check
# Expected: both clean
```

## Validation and acceptance

1. `bun run audit` exits 0 on the current repo (which is clean after the audit commit)
2. `bun run check` passes — all existing tests + new audit tests
3. Manually introduce drift (e.g., `mkdir extensions/phantom`) → `bun run audit` exits 1 with E1/E2/E3 errors pointing at the right files with actionable hints
4. Manually set a plan to `Status: Completed` in active/ → `bun run audit` exits 1 with E4

## Idempotence and recovery

All changes are additive (new files). Safe to re-run any step. No existing files are modified except package.json (new script entry) and CONTRIBUTING-DOCS.md (one paragraph addition).

## Artifacts and notes

- `scripts/audit-docs.ts` — main audit script (error checks E1–E6, advisory checks A1–A3)
- `scripts/__tests__/audit-docs.test.ts` — 13 fixture-based tests
- `package.json` — added `"audit"` script
- `docs/CONTRIBUTING-DOCS.md` — updated section 8 to document audit script

## Interfaces and dependencies

- Node.js fs/path APIs (same as validate-docs)
- `child_process.spawnSync` for vitest and git invocations
- No new npm dependencies
