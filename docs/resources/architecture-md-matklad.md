---
title: "ARCHITECTURE.md"
type: article
source: blog
url: https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html
author: Aleksey Kladov (matklad)
date_published: 2021-02-06
date_captured: 2026-03-05
tags:
  - architecture
  - documentation
  - codemap
  - onboarding
  - open-source
  - progressive-disclosure
  - contributor-experience
related:
  - "[[harness-engineering-openai]]"
status: reviewed
impact: foundational
description: >
  matklad argues every 10k–200k line project should have an ARCHITECTURE.md that provides
  a bird's-eye codemap, names important entities, calls out invariants, and stays short
  enough to survive bitrot. The biggest contributor bottleneck is not writing patches —
  it's figuring out *where* to change code.
---

# ARCHITECTURE.md — matklad

> **Core claim**: The biggest gap between an occasional contributor and a core developer
> is knowledge of the **physical architecture**. It takes 2× more time to write a patch
> if you're unfamiliar, but **10× more time to figure out where to change the code**.
> An ARCHITECTURE file is a low-effort, high-leverage way to bridge that gap.

## Key Ideas

### 1. The Mental Map Problem

Core developers don't read code sequentially — they have a mental map and jump to where
things should be. New contributors lack this map and spend most of their time lost.
ARCHITECTURE.md externalizes that mental map.

### 2. Keep It Short and Stable

- Every recurring contributor must read it, so brevity matters.
- Only describe things **unlikely to frequently change**.
- Don't try to keep it synchronized with code — revisit a couple of times a year.
- Short documents resist bitrot better than long ones.

### 3. Structure: Overview → Codemap → Cross-Cutting Concerns

1. **Bird's eye overview** of the problem being solved
2. **Codemap** — coarse-grained modules and how they relate
   - Should answer: "where's the thing that does X?"
   - Should answer: "what does the thing I'm looking at do?"
   - Country map, not an atlas of state maps — no internal module details
3. **Cross-cutting concerns** — patterns that span multiple modules

### 4. Name Things, Don't Link Them

- **Do** name important files, modules, and types
- **Don't** directly link them — links go stale
- Encourage the reader to use symbol/file search to find entities by name
- This is zero-maintenance and helps discover related, similarly named things

### 5. Call Out Invariants (Especially Absences)

- Important invariants are often expressed as the **absence** of something
- Hard to discover by reading code — you can't see what's intentionally not there
- Example: "nothing in the model layer depends on views"

### 6. Call Out Boundaries

- Boundaries between layers/systems implicitly constrain all possible implementations
- Finding boundaries by randomly reading code is hard — "good boundaries have measure zero"
- Explicitly documenting them saves enormous discovery time

## How This Relates to Our Repo

| matklad Principle | Our Application |
|-------------------|-----------------|
| Short, stable ARCHITECTURE.md | Already practiced — `docs/ARCHITECTURE.md` covers domains and boundaries |
| Codemap over detailed docs | Our architecture doc describes coarse modules; details live in extension READMEs |
| Name things, don't link | We should name key files/types and rely on search, not fragile links |
| Call out invariants | Adding an explicit "Invariants" section to ARCHITECTURE.md |
| Cross-cutting concerns | Adding a dedicated section for patterns that span extensions/skills |
| Don't sync with code | Remove volatile lists (individual extension/skill names) that rot quickly |
| Revisit periodically | Already tracked via `Last updated` header |

### What We Changed Based on This

- Restructured `docs/ARCHITECTURE.md` to follow matklad's recommended flow:
  overview → codemap → invariants → cross-cutting concerns
- Removed enumerated extension/skill lists that would go stale
- Added explicit invariants and boundaries sections
- Created `docs/CONTRIBUTING-DOCS.md` as the companion governance document

## Quotes Worth Keeping

- "It takes 2× more time to write a patch if you are unfamiliar with the project,
  but it takes 10× more time to figure out where you should change the code."
- "Only specify things that are unlikely to frequently change."
- "A codemap is a map of a country, not an atlas of maps of its states."
- "Do name important files, modules, and types. Do not directly link them."
- "Important invariants are expressed as an absence of something, and it's pretty
  hard to divine that from reading the code."
- "Good boundaries have measure zero."

## Reference Example

matklad points to the rust-analyzer architecture doc as a gold-standard example:
`rust-analyzer/docs/dev/architecture.md` (search the rust-analyzer repo).

---

*Captured: 2026-03-05. Direct article read.*
