---
name: audit
description: Run a documentation freshness audit on this repository. Use when asked to check if docs are up to date, do a health check, audit the repo, or when starting a maintenance session.
---

# Audit

Run a documentation and structural freshness audit on this repository.

## When to use

- The user asks to "audit", "health check", or "check if docs are up to date"
- Starting a maintenance or housekeeping session
- After a batch of work that touched multiple extensions, skills, or exec plans
- Periodically, as a librarian pass

## Step 1: Run the automated audit

```bash
bun run audit
```

This runs `scripts/audit-docs.ts` and reports two severity levels:

- **Errors (exit 1)** — provably wrong, fix immediately:
  - Extension missing from ARCHITECTURE.md, README.md, or QUALITY.md scorecard
  - Completed exec plan still in `active/`
  - Phantom or missing entries in the exec-plans/README index

- **Advisories (exit 0)** — need human judgment, flag to the user:
  - Test count in QUALITY.md doesn't match actual vitest output
  - `Last updated` date >7 days behind git history
  - Active plan with all milestones checked off

Fix all errors. Present advisories to the user for a decision — do not silently act on them.

## Step 2: Fix errors from the automated audit

For each error, apply the fix described in the hint. Common patterns:

| Error | Fix |
|---|---|
| Extension missing from docs | Add it to ARCHITECTURE.md codemap, README.md structure, and QUALITY.md scorecard |
| Completed plan in `active/` | Move file to `completed/`, update exec-plans/README.md index |
| Phantom index entry | Remove the stale wikilink from exec-plans/README.md |
| Plan missing from index | Add a wikilink to the correct section of exec-plans/README.md |

After fixing, re-run `bun run audit` to confirm clean output.

## Step 3: Triage advisories with the user

Present each advisory and ask what to do. Typical actions:

- **Test count drift** → update the coverage baseline in QUALITY.md
- **Last-updated date drift** → update the `Last updated:` header in the affected file
- **All milestones complete** → ask the user if the plan is truly done; if yes, mark `Status: Completed` and move to `completed/`

## Step 4: Manual review (judgment-based)

The automated audit catches structural drift. These checks require reading comprehension and are not automated:

1. **Scorecard ratings** — are the scores in QUALITY.md still accurate given recent changes?
2. **Tech debt tracker** — are any P1/P2 items resolved but still listed?
3. **Extension README accuracy** — do the behavior descriptions still match the code?
4. **ARCHITECTURE.md boundaries/invariants** — has anything shifted that the codemap doesn't reflect?
5. **Spec/plan cross-references** — do specs and plans still link to each other correctly?

Skim these quickly. Only flag things that are clearly wrong — don't rewrite docs for style during an audit.

## Step 5: Commit

If changes were made, commit with:

```
docs: audit and update stale docs
```

Use a single commit for all audit fixes unless changes are large enough to warrant separation.

## What NOT to do during an audit

- Don't refactor code — this is a docs-only pass
- Don't update scorecard ratings without the user's input
- Don't chase advisories into rabbit holes — flag them and move on
- Don't fill your own context with a long remediation task list — fix what's broken, flag what's ambiguous, and stop
