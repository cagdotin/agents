# Architecture

## What to look for
- Responsibilities moved into the wrong layer or module
- New coupling between parts of the system that were previously isolated
- Bypassing existing abstractions, boundaries, or extension points
- Pattern drift that makes this area inconsistent with surrounding code
- Structural changes that make future changes harder to localize
- Public surface changes that ripple through unrelated areas

## Questions to ask
- Does this change preserve the intended dependency direction?
- Is the new logic living in the most appropriate place?
- Does it reuse an existing pattern, or introduce a competing one?
- Will follow-up changes remain easy to make in one place?
- Does the abstraction simplify the system, or just move complexity around?

## Common patterns to flag
- Request, UI, or transport code owning business rules it should delegate
- Shared modules gaining feature-specific exceptions
- New global state or hidden cross-module coordination
- Repeated orchestration copied into multiple call sites
- Leaky abstractions that force callers to know internal details
- Structural fixes patched at the edges instead of at the real boundary

## Context to gather
- Read nearby modules that solve similar problems
- Check repository docs or design notes for the intended boundaries
- Inspect the existing public interfaces around the changed area
- Compare against established patterns before calling something an issue
