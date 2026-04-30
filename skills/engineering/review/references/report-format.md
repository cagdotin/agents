# Review Report

Use this as the core output shape for review findings.

## Summary

A short paragraph covering:
- what was reviewed
- how the scope was determined
- the overall assessment

## Findings

Group findings by lens. Omit lenses with no findings.

### [Lens Name]

#### [blocking|warning|note] Finding title
- **Location**: `path/to/file.ext:line` or a clear region/function name
- **Description**: what the issue is
- **Why it matters**: impact, failure mode, or maintenance risk
- **Suggestion**: what to change, if a concrete fix is appropriate

## Verdict (optional)

Include this only when the calling workflow asks for a decision, such as a PR review.

Use one of:
- **Approve**
- **Request Changes**
- **Comment**

## Workflow-specific wrappers

Other workflows may add extra sections around this core report.
Examples include PR-specific sections such as:
- Claims vs Reality
- Change Analysis
- Merge recommendation rationale
