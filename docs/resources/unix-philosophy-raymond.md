---
title: "Basics of the Unix Philosophy"
type: article
source: blog
url: https://cscie2x.dce.harvard.edu/hw/ch01s06.html
author: Eric S. Raymond
date_published: 2003-09-19
date_captured: 2026-03-10
tags:
  - design-principles
  - modularity
  - simplicity
  - composition
related:
  - "[[deep-modules-ai-ready-codebase]]"
  - "[[architecture-md-matklad]]"
status: applied
impact: foundational
description: >
  Eric Raymond's distillation of 17 Unix design rules from The Art of Unix Programming.
  Adopted as the design-principles lens for this repo's audit skill.
---

# Basics of the Unix Philosophy

From *The Art of Unix Programming*, Chapter 1.

## The 17 Rules

1. **Rule of Modularity**: Write simple parts connected by clean interfaces.
2. **Rule of Clarity**: Clarity is better than cleverness.
3. **Rule of Composition**: Design programs to be connected to other programs.
4. **Rule of Separation**: Separate policy from mechanism; separate interfaces from engines.
5. **Rule of Simplicity**: Design for simplicity; add complexity only where you must.
6. **Rule of Parsimony**: Write a big program only when it is clear by demonstration that nothing else will do.
7. **Rule of Transparency**: Design for visibility to make inspection and debugging easier.
8. **Rule of Robustness**: Robustness is the child of transparency and simplicity.
9. **Rule of Representation**: Fold knowledge into data so program logic can be stupid and robust.
10. **Rule of Least Surprise**: In interface design, always do the least surprising thing.
11. **Rule of Silence**: When a program has nothing surprising to say, it should say nothing.
12. **Rule of Repair**: When you must fail, fail noisily and as soon as possible.
13. **Rule of Economy**: Programmer time is expensive; conserve it in preference to machine time.
14. **Rule of Generation**: Avoid hand-hacking; write programs to write programs when you can.
15. **Rule of Optimization**: Prototype before polishing. Get it working before you optimize it.
16. **Rule of Diversity**: Distrust all claims for "one true way".
17. **Rule of Extensibility**: Design for the future, because it will be here sooner than you think.

## How This Relates to Our Repo

- These rules are the basis of the **design-principles** audit lens (`.pi/skills/audit/references/lenses/design-principles.md`).
- Reinforces existing invariants: extension isolation (Modularity), agent-legible errors (Repair), no-build-step simplicity (Economy, Simplicity), data-driven rules in damage-control (Representation).
- Complements [[deep-modules-ai-ready-codebase]] on module boundaries and [[architecture-md-matklad]] on structural clarity.

## Quotes Worth Keeping

- "Rule of Robustness: Robustness is the child of transparency and simplicity."
- "Rule of Representation: Fold knowledge into data so program logic can be stupid and robust."
- "Rule of Repair: When you must fail, fail noisily and as soon as possible."

---

Capture notes: 2026-03-10, direct web access. Originally from Chapter 1 of *The Art of Unix Programming* (2003), hosted at Harvard CSCI E-2x course materials.
