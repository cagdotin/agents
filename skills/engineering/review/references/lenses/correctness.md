# Correctness

## What to look for
- Wrong conditions, missing branches, or off-by-one behavior
- Invalid assumptions about input shape, ordering, or defaults
- Null, undefined, empty-state, or partial-state handling gaps
- Error paths that leave state inconsistent or silently hide failure
- Async ordering, retries, idempotency, or race-related bugs
- Type assumptions that are not actually enforced at runtime
- Breaking behavior changes for callers, stored data, or existing flows

## Questions to ask
- Do all meaningful branches and edge cases behave correctly?
- What happens when input is missing, malformed, delayed, or duplicated?
- Are state transitions valid before and after failure?
- Could concurrent or repeated execution change the outcome unexpectedly?
- Are types, schemas, units, and invariants aligned end to end?

## Common patterns to flag
- Inverted conditions or incorrect early returns
- Missing `await`, stale reads, or updates based on outdated state
- Swallowed errors or fallbacks that mask real problems
- Silent coercions that turn bad input into misleading output
- Schema mismatches between callers, storage, and UI
- Correctness relying on undocumented behavior from another component

## Context to gather
- Read adjacent code paths, callers, and tests for expected behavior
- Check data models, schemas, and comments near the changed logic
- Verify whether the surrounding code already handles retries or ordering
- Prefer concrete examples of failure over abstract suspicion
