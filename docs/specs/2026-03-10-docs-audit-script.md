# Docs Audit Script

Status: Draft
Date: 2026-03-10
Execution plan: [[docs/exec-plans/active/2026-03-10-docs-audit-script]]

## 1. Problem statement

Documentation drifts from reality between sessions. Extensions get added without updating the codemap, exec plans complete without being moved, test counts grow without updating the scorecard, and tech debt items get resolved without cleanup. Today the only way to catch this is a manual walkthrough — slow, easy to skip, and dependent on someone remembering to do it.

We need an automated audit script that catches provably-stale documentation and flags things that need a human look, without injecting noise into the normal development workflow.

## 2. Goals and non-goals

### 2.1 Goals

- Catch structural doc/code drift that a filesystem scan can prove (errors)
- Flag heuristic drift that needs human judgment (advisories)
- Run as `bun run audit` — separate from `bun run check`, invoked deliberately
- Exit code 1 on errors, exit code 0 on advisories-only or clean
- Agent-legible output: what's wrong, where, and how to fix it
- Testable with the same temp-dir fixture pattern as `validate-docs.ts`

### 2.2 Non-goals

- Replacing `validate-docs.ts` — that script checks structural validity (frontmatter, READMEs); this one checks freshness and consistency
- Running in pre-commit or CI — this is an on-demand health check
- Automating fixes — the script reports; humans or agents decide what to do
- Sub-agent / librarian automation — future follow-up, not part of this work
- Judging whether scorecard ratings are accurate or README descriptions match behavior — that requires reading comprehension, not filesystem checks

## 3. System context

### Affected modules

- `scripts/audit-docs.ts` — new file
- `scripts/__tests__/audit-docs.test.ts` — new file
- `package.json` — new `audit` script entry
- `docs/CONTRIBUTING-DOCS.md` — mention the audit script alongside `validate-docs`

### Existing patterns to follow

- `scripts/validate-docs.ts` — same file structure, same error reporting shape, same Zod-for-boundaries approach
- `scripts/__tests__/validate-docs.test.ts` — same temp-dir fixture pattern with `spawnSync`

### Integration points

- Reads: `extensions/`, `skills/`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/exec-plans/active/`, `docs/exec-plans/completed/`, `docs/exec-plans/README.md`, `README.md`
- Runs: `git log` for timestamp checks (graceful fallback if not in a git repo)
- Runs: `vitest run --reporter=json` for test count (or parses last known output)

## 4. Domain model

### Finding severity

Two levels, not three:

```
error    — provably wrong, no judgment needed, exit code 1
advisory — heuristic flag, needs human review, exit code 0
```

No "warning" level. The word "warning" is ambiguous to agents — it reads as "maybe fix, maybe ignore." Errors are actionable. Advisories are informational.

### Finding shape

Same structure as `validate-docs.ts` but with a severity field:

```ts
type AuditFinding = {
  severity: "error" | "advisory"
  file_path: string
  message: string
  hint: string
}
```

## 5. Detailed design

### 5.1 Error checks (exit code 1 if any found)

**E1: Extension missing from ARCHITECTURE.md codemap**
- Scan `extensions/` for directories (skip `__mocks__`)
- For each, check that its name appears in `docs/ARCHITECTURE.md` in the codemap section
- Hint: "Add `<name>` to the Key extensions list in docs/ARCHITECTURE.md"

**E2: Extension missing from README.md structure**
- Same scan, check each extension name appears in the structure tree in `README.md`
- Hint: "Add `<name>/` to the extensions listing in README.md"

**E3: Extension missing from QUALITY.md scorecard**
- Same scan, check each extension name appears in a scorecard table row in `docs/QUALITY.md`
- Hint: "Add a scorecard row for `<name>` in docs/QUALITY.md"

**E4: Completed exec plan in active/**
- Scan `docs/exec-plans/active/*.md` for `Status: Complete` or `Status: Completed` (case-insensitive)
- Hint: "Move this file to docs/exec-plans/completed/ — its status is already marked complete"

**E5: Exec plan index has phantom entries**
- Parse `docs/exec-plans/README.md` for `[[docs/exec-plans/...]]` references
- Check each referenced path exists on disk
- Hint: "Remove or update the stale reference in docs/exec-plans/README.md"

**E6: Exec plan file missing from index**
- For each `.md` file in `active/` and `completed/`, check it appears in `docs/exec-plans/README.md`
- Hint: "Add this plan to the active or completed section of docs/exec-plans/README.md"

### 5.2 Advisory checks (exit code 0, printed as info)

**A1: Test count drift**
- Run `vitest run --reporter=json` (or parse json output)
- Extract total test count and file count
- Compare against the numbers in `docs/QUALITY.md` (regex for `\d+ unit tests across \d+ files` or the baseline line)
- Advisory if actual differs from documented
- Hint: "QUALITY.md says N tests across M files; actual is X tests across Y files"

**A2: Last-updated date drift**
- For files with `Last updated: YYYY-MM-DD` headers: `ARCHITECTURE.md`, `QUALITY.md`, `tech-debt-tracker.md`
- Compare the documented date against `git log -1 --format=%ai <file>` (most recent commit touching that file)
- Advisory if the git date is >7 days newer than the documented date
- Graceful skip if not in a git repo
- Hint: "Last updated says <date> but file was last modified <git-date>"

**A3: All milestones complete in active plan**
- Scan `docs/exec-plans/active/*.md` for plans where every `- [` line is `- [x]` and none are `- [ ]`
- Advisory (not error — there may be unlisted remaining work like "manual verification")
- Hint: "All milestones are checked off — consider marking Status: Completed and moving to completed/"

## 6. Error handling and failure modes

- **Not a git repo**: skip A2 gracefully, log "(skipping git date checks — not a git repository)"
- **vitest not available or fails**: skip A1 gracefully, log "(skipping test count check — vitest run failed)"
- **Missing docs files** (e.g., no ARCHITECTURE.md): skip checks that depend on it with a single advisory noting the file is missing
- **Malformed markdown in scanned files**: regex-based checks should be lenient — if a pattern doesn't match, skip that check for that file rather than crashing

## 7. Testing strategy

### 7.1 Unit tests

Use the same temp-dir + `spawnSync` pattern as `validate-docs.test.ts`:

- **Clean fixture passes**: set up a repo with consistent docs → exit 0, no findings
- **E1–E3 extension drift**: add an extension dir without updating ARCHITECTURE/README/QUALITY → exit 1 with correct error messages
- **E4 completed plan in active**: put a `Status: Completed` plan in active/ → exit 1
- **E5–E6 index drift**: add/remove plan files without updating README → exit 1
- **A3 all milestones done**: plan with all `[x]` in active/ → exit 0 with advisory message
- **Advisory-only exits 0**: ensure advisories alone don't cause exit 1

A1 and A2 are harder to test in isolation (require git history and vitest). These can be tested by:
- A1: mock a QUALITY.md with a known count and a fake vitest json output file (or skip in unit tests and rely on integration)
- A2: create a git repo in the temp dir, commit a file, then backdate the `Last updated` header

### 7.2 Integration

Manual `bun run audit` against the real repo after implementation. Not automated.

## 8. Implementation checklist

- [ ] Create `scripts/audit-docs.ts` with error and advisory checks
- [ ] Create `scripts/__tests__/audit-docs.test.ts` with fixture-based tests
- [ ] Add `"audit": "bun run scripts/audit-docs.ts"` to package.json
- [ ] Update `docs/CONTRIBUTING-DOCS.md` section 8 to mention the audit script
- [ ] Run `bun run audit` on the real repo and verify clean output
- [ ] Run `bun run check` to ensure nothing regresses

## 9. Open questions

1. **Should A1 (test count) run vitest or parse a cached json file?** Running vitest adds ~1s but is always accurate. A cached file is faster but can itself be stale. Recommendation: run vitest — the script is already on-demand, not in the hot path.

2. **Should the README.md structure check (E2) be strict about tree format?** The current README uses a specific indented tree. Recommendation: just check that the extension name string appears anywhere in README.md — low false-positive risk and resilient to formatting changes.
