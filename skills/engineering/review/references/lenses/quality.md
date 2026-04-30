# Quality

## What to look for
- Unnecessary duplication, complexity, or confusing control flow
- Naming, structure, or abstractions that hide intent
- Dead code, stale branches, or temporary code that became permanent
- Error messages, logs, and comments that are noisy, vague, or misleading
- Missing or outdated docs for user-facing or maintenance-critical changes
- Implementation changes that outgrow the documented scope without updating surrounding docs or plans
- Accessibility issues when UI behavior, markup, or interactions change

## Questions to ask
- Can a future maintainer understand this change quickly?
- Is the abstraction level appropriate, or does it obscure simple logic?
- Did the change add incidental complexity that could be avoided?
- Are logs, errors, and comments useful at the point of failure?
- If the change affects users or operators, were docs and affordances updated?
- If the change affects UI, can people still use it accessibly?

## Common patterns to flag
- Giant functions, boolean soups, or deeply nested branching
- Magic strings, numbers, or protocol details with no explanation
- Misleading names that no longer match the behavior
- Debug logging that adds noise without diagnostic value
- Comments that restate the code while hiding missing explanation elsewhere
- Behavior that quietly expands beyond the agreed or documented change boundary
- UI changes missing labels, focus handling, contrast, or keyboard support

## Context to gather
- Compare with nearby code that is considered clean and maintainable
- Check docs, examples, or operator guidance affected by the change
- For UI work, inspect surrounding components and interaction patterns
- Suggest simplifications when they reduce risk, not just style differences
