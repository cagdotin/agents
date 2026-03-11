# Audit Report

Use this as the output shape for audit findings.

## Scope

What was audited, which lenses were applied, and why.

## Summary

A short paragraph covering the overall health assessment.
Is the repo trending toward or away from its standards?

## Findings

Group findings by lens. Omit lenses with no findings.

### [Lens Name]

#### [error|advisory|concern|violation|note] Finding title

- **Where**: file path, doc section, or region
- **What**: concrete observation
- **Why it matters**: impact on maintainability, correctness, or agent usability
- **Suggested action**: what to do about it
- **Urgency**: fix now / fix soon / address when next in this code

## Recommendations

Prioritized list of actions, ordered by impact.
Separate quick wins from larger efforts.

## Notes

- Omit lenses and principles that cleanly pass — don't pad the report.
- Distinguish between things the agent can fix (with user approval) and things that need user judgment.
- For docs-freshness automated errors, re-run `bun run audit` after fixes to confirm clean output.
