# Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use a parallel design pass. This is based on the idea that your first interface is unlikely to be your best one.

Uses the vocabulary in [language.md](./language.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before branching into alternatives, write a user-facing explanation of the problem space for the chosen candidate:

- the constraints any new interface would need to satisfy
- the dependencies it would rely on, and which category they fall into (see [deepening.md](./deepening.md))
- a rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while you explore options.

### 2. Generate multiple interface options

If subagents are available, spawn 3 or more in parallel. If not, reason through at least 3 radically different interface designs yourself.

Each design should follow a distinct constraint:

- Option 1: minimize the interface — aim for 1 to 3 entry points max. Maximize leverage per entry point.
- Option 2: maximize flexibility — support many use cases and extension.
- Option 3: optimize for the most common caller — make the default case trivial.
- Option 4, if applicable: design around ports and adapters for cross-seam dependencies.

Use both [language.md](./language.md) vocabulary and `CONTEXT.md` vocabulary so each design names things consistently with the architecture language and the project's domain language.

Each option should include:

1. Interface (types, methods, params — plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [deepening.md](./deepening.md))
5. Trade-offs — where leverage is high, where it's thin

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.
