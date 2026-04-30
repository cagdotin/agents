# Agents package

This context defines the documentation language for the shared Pi package of extensions, skills, themes, and support docs used by coding agents.

## Language

**Domain memory**:
The canonical vocabulary of the repo's problem space and concepts.
_Avoid_: glossary, repo knowledge, terminology notes

**Decision memory**:
The durable record of meaningful architecture and design choices.
_Avoid_: random notes, implementation diary, tribal knowledge

**Method memory**:
The reusable instructions that tell agents and humans how work should be done in this repo.
_Avoid_: contributor notes, process trivia, one-off reminders

**Architecture overview**:
The stable bird's-eye explanation of the package, its major parts, and where to look next.
_Avoid_: implementation detail, change log, full code tour

**Agent configuration**:
The small set of repo-local settings that shared skills need in order to behave correctly in this repo.
_Avoid_: narrative docs, broad contribution guidance, architecture explanation

**Coding conventions**:
The repo-wide naming and style rules that code and docs should follow.
_Avoid_: contributor guide, architecture rationale, implementation tutorial

**Testing conventions**:
The repo-specific rules for how tests are organized, scoped, and run in this package.
_Avoid_: quality dashboard, generic test tutorial, implementation backlog

**Planning artifact**:
An active design or execution record used for genuinely complex, multi-session, or architecture-shaping work.
_Avoid_: default backlog, routine task notes, permanent status ledger

**Issue tracker**:
The canonical backlog for tech debt, follow-up work, and audits that require action.
_Avoid_: markdown backlog, side notes, scorecard backlog

**Shared reference**:
A stable repo-wide reference that applies across multiple skills, modules, or workflows without having one narrow owner.
_Avoid_: module note, skill-local cheat sheet, junk drawer reference

**Owned reference**:
A reference that belongs next to the skill, module, or extension it explains, even when reused widely.
_Avoid_: top-level catch-all reference, detached documentation

**Entry surface**:
A top-level document that routes a reader to the right next source without duplicating deeper documentation.
_Avoid_: overlapping overview, repeated detail, mixed audience document

**Structural enforcement**:
A mechanical check that enforces the presence, absence, or placement of documentation artifacts without trying to judge prose quality.
_Avoid_: subjective scoring, narrative quality grading, maintenance theater

## Relationships

- **Domain memory** lives in `CONTEXT.md`
- **Decision memory** lives in ADRs and active **Planning artifacts**
- **Method memory** lives in skills and supporting references
- The **Architecture overview** points readers toward the right **Decision memory** when they need rationale or detail
- **Agent configuration** lives under `docs/agents/`
- **Coding conventions** and **Testing conventions** live in dedicated stable references
- **Shared references** belong in top-level `docs/references/`, while **Owned references** live next to their natural owner
- **Planning artifacts** are active working context, while the **Issue tracker** remains the canonical backlog
- Each **Entry surface** has a narrow audience and routing job
- **Structural enforcement** guards the documentation model by checking structure, not by scoring prose

## Example dialogue

> **Dev:** "Should this go into the glossary, an ADR, or a skill?"
> **Domain expert:** "If it's a repo concept, put it in **Domain memory**. If it's a durable trade-off, put it in **Decision memory**. If it's a reusable way of working, put it in **Method memory**."
