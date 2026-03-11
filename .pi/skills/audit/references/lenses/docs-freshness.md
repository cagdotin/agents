# Docs Freshness

Checks whether documentation and structural metadata are honest and current.

## Automated checks

Run `bun run audit` first. It reports two severity levels:

### Errors (exit 1) — provably wrong, must fix

- Extension missing from ARCHITECTURE.md, README.md, or QUALITY.md scorecard
- Completed exec plan still in `active/`
- Phantom or missing entries in the exec-plans/README index

Common fixes:

| Error | Fix |
|---|---|
| Extension missing from docs | Add to ARCHITECTURE.md codemap, README.md structure, and QUALITY.md scorecard |
| Completed plan in `active/` | Move to `completed/`, update exec-plans/README.md index |
| Phantom index entry | Remove stale wikilink from exec-plans/README.md |
| Plan missing from index | Add wikilink to correct section of exec-plans/README.md |

### Advisories (exit 0) — need human judgment

- Test count in QUALITY.md doesn't match actual vitest output
- `Last updated` date >7 days behind git history
- Active plan with all milestones checked off

Present advisories to the user. Do not act on them without approval.

## Manual checks

These require reading comprehension and are not automated:

1. **Scorecard ratings** — are QUALITY.md scores still accurate given recent changes?
2. **Tech debt tracker** — are any P1/P2 items resolved but still listed?
3. **Extension README accuracy** — do behavior descriptions still match the code?
4. **ARCHITECTURE.md boundaries/invariants** — has anything shifted that the codemap doesn't reflect?
5. **Spec/plan cross-references** — do specs and plans still link to each other correctly?

Skim quickly. Only flag things that are clearly wrong — don't rewrite docs for style.
