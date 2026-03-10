# Testing

## What to look for
- New behavior without coverage for the main path and likely failures
- Bug fixes without a regression test that would fail before the fix
- Tests that only prove implementation details instead of behavior
- Missing coverage for edge cases, boundaries, or integration seams
- Brittle, flaky, or overly mocked tests that hide real risk
- Removed or weakened assertions without clear justification

## Questions to ask
- What important behavior could still break unnoticed after this change?
- Would these tests catch the bug or regression the code is trying to prevent?
- Are failure modes and edge cases covered proportionally to the risk?
- Do the tests increase confidence, or just add activity around the code?
- Is the chosen test level appropriate for the kind of change?

## Common patterns to flag
- Happy-path-only tests for logic with obvious edge cases
- Snapshot-only coverage for behavior that needs explicit assertions
- Tests tightly coupled to internal implementation steps
- Heavy mocking that removes the real contract under test
- Time, randomness, filesystem, or network dependence without control
- Missing assertions on error cases, retries, or rollback behavior

## Context to gather
- Review nearby tests to match the repository's testing style and level
- Look at past bugs or changed behavior to find the real regression risk
- Consider whether the change is best covered by unit, integration, or end-to-end tests
- When calling out a gap, name the scenario that should be tested
