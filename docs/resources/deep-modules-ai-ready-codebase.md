---
title: "Your Codebase Is Probably Not Ready for AI"
type: video
source: youtube
url: https://www.youtube.com/watch?v=uC44zFz7JSM
author: AI Hero (Matt Pocock)
date_captured: 2026-03-11
tags:
  - deep-modules
  - software-architecture
  - ai-ready-codebase
  - module-boundaries
  - progressive-disclosure
  - testing
  - cognitive-load
  - philosophy-of-software-design
related:
  - "[[harness-engineering-openai]]"
  - "[[architecture-md-matklad]]"
status: reviewed
impact: informative
description: >
  Argues that your codebase — not your prompt or AGENTS.md — is the biggest influence on
  AI output. Applies the "deep modules" concept from A Philosophy of Software Design to
  AI coding: design large modules with simple interfaces, test at boundaries, and let AI
  handle implementation while humans apply taste at the seams.
---

# Your Codebase Is Probably Not Ready for AI

> **Key claim**: Software quality matters more than ever. AI is a perpetual new starter
> with no memory — your codebase's structure determines whether it can navigate, understand,
> and change things effectively.

## Summary

The video argues that most codebases are webs of small, shallow, interconnected modules
that are hard for AI to navigate. The fix: restructure into **deep modules** — large chunks
of implementation behind simple, well-defined interfaces. This concept comes from John
Ousterhout's *A Philosophy of Software Design*. The author extends this into **graybox
modules**: humans design and test interfaces, AI handles internals.

## Key Ideas

- **AI sees no map** — Unlike you, AI doesn't carry a mental model of your codebase. It
  sees a flat collection of modules that can all import from each other. Your file system
  and module structure must reflect the conceptual map you hold in your head.

- **Deep modules over shallow modules** — Instead of many small modules with many exports,
  create fewer large modules with simple interfaces. All exports must go through the
  interface. This is a 20-year-old software practice that's now more important than ever.

- **Graybox modules** — You don't need to look inside a module as long as tests pass. AI
  manages implementation; humans apply taste at the boundaries (interface design, what
  belongs where, how modules compose).

- **Three benefits**:
  1. **Navigability** — AI can read interfaces/types without diving into implementation.
     Progressive disclosure: interface explains what it does, internals only when needed.
  2. **Reduced cognitive burnout** — Hold 7-8 services in your head instead of dozens of
     tiny modules. Focus on designing interfaces and how they fit together.
  3. **What works for humans works for AI** — Good software practices from the past 20
     years are exactly what AI needs too.

- **Think about modules at every stage** — From PRDs to implementation issues, always
  consider which modules you're affecting, their interfaces, and how to test them. Tests
  and feedback loops are essential because AI is always a new starter.

- **Language tooling matters** — TypeScript/JavaScript don't naturally enforce module
  boundaries. The author mentions Effect as a library that makes modularizing and
  "seaming" a codebase simpler.

## Extracted Links and Context

| Link | Context |
|------|---------|
| [A Philosophy of Software Design](https://www.amazon.com/Philosophy-Software-Design-2nd/dp/173210221X) | John Ousterhout's book — source of the "deep modules" concept |
| [AI Hero Newsletter](https://aihero.dev) | Author's newsletter on AI coding for engineers (not vibe coders) |

## How This Relates to Our Repo

| Video Principle | Our Implementation | Gap |
|---|---|---|
| Deep modules with simple interfaces | Extensions have clear tool APIs via TypeBox schemas | Extensions can import each other's internals freely — no enforcement |
| Progressive disclosure | Expertise system (`.pi/expertise`) orients first, dig deeper as needed | ✅ Already strong |
| File system reflects conceptual map | `extensions/`, `skills/`, `docs/` — well-organized | ✅ Already strong |
| AI is a perpetual new starter | AGENTS.md, READMEs per extension, agent-legible errors | ✅ Already strong |
| Test at boundaries | `bun run check` for mechanical enforcement | Could add boundary-specific tests per extension |
| Enforce module boundaries | Not currently enforced — any extension can import from another's internals | **Key gap** — needs lint rules or barrel exports |

## Actionable Follow-Ups

- [ ] Evaluate enforcing module boundaries between extensions (barrel exports, lint rules, or import restrictions)
- [ ] Audit current cross-extension imports to assess coupling
- [ ] Consider whether shared utilities should be extracted into a common module to reduce cross-imports
- [ ] Look into Effect or similar patterns for TypeScript module boundary enforcement

## Quotes Worth Keeping

- "Your codebase, way more than the prompt that you used, way more than your agents.md file, is the biggest influence on AI's output."
- "AI when it jumps into your codebase, it has no memory. It's like the guy from Memento."
- "You need to be spawning like 20 new starters every day just to look at your codebase and make changes."
- "This is nothing new. This is a 20-year-old software practice."

---

Capture notes: 2026-03-11. Transcript fetched via youtube-transcript skill. All timestamps
in the transcript were 0:00 (likely a transcript formatting issue), but content was complete.
