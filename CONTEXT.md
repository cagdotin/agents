# Agents package

This context defines the documentation language for the shared Pi package of extensions, skills, themes, and support docs used by coding agents. It exists to keep documentation work aligned on what kind of memory belongs in which artifact.

## Language

**Domain memory**:
The canonical vocabulary of the repo's problem space and concepts.
_Avoid_: glossary, repo knowledge, terminology notes

**Decision memory**:
The durable record of why meaningful architecture and design choices were made.
_Avoid_: random notes, implementation diary, tribal knowledge

**Method memory**:
The reusable instructions that tell agents and humans how work should be done in this repo.
_Avoid_: contributor notes, process trivia, one-off reminders

**Architecture overview**:
The stable bird's-eye explanation of the package, its major parts, and where to look next.
_Avoid_: implementation detail, change log, full code tour

**Quality signal**:
An objective indication that the repo is healthy, produced by automated checks rather than narrative scorecards.
_Avoid_: status writeup, subjective score, maintenance diary

**Issue tracker**:
The canonical backlog for tech debt, follow-up work, and audits that require action.
_Avoid_: markdown backlog, side notes, scorecard backlog

**Coding conventions**:
The repo-wide naming and style rules that code and docs should follow.
_Avoid_: contributor guide, architecture rationale, implementation tutorial

**Design principles**:
The small set of enduring principles that constrain how this package is designed.
_Avoid_: research dump, ADR replacement, repeated architecture overview

**Agent configuration**:
The small set of repo-local settings that shared skills need in order to behave correctly in this repo.
_Avoid_: narrative docs, broad contribution guidance, architecture explanation

**Planning artifacts**:
Temporary-but-important design and execution records used for genuinely complex, multi-session, or architecture-shaping work.
_Avoid_: default backlog, routine task notes, permanent status ledger

**Shared reference**:
A stable repo-wide reference that applies across multiple skills, modules, or workflows without having one narrow owner.
_Avoid_: module note, skill-local cheat sheet, junk drawer reference

**Owned reference**:
A reference that belongs next to the skill, module, or extension it explains, even when reused widely.
_Avoid_: top-level catch-all reference, detached documentation

**Entry surface**:
A top-level document that routes a reader to the right next source without duplicating deeper documentation.
_Avoid_: overlapping overview, repeated detail, mixed audience document

**Obsolete doc**:
A document that no longer fits the active memory model and should be removed once all routing and dependencies are updated.
_Avoid_: deprecated limbo doc, orphaned reference target, shadow source of truth

**Structural enforcement**:
A mechanical check that enforces the presence, absence, or placement of documentation artifacts without trying to judge prose quality.
_Avoid_: freshness theater, subjective scoring, narrative quality grading

**Testing conventions**:
The repo-specific rules for how tests are organized, scoped, and run in this package.
_Avoid_: quality dashboard, generic test tutorial, implementation backlog

**Category guide**:
A small README for a surviving doc category that explains when to use that category and what belongs there.
_Avoid_: duplicate top-level map, narrative handbook, stale index theater

## Relationships

- **Domain memory** lives in `CONTEXT.md`
- **Decision memory** lives in ADRs, specs, and execution plans
- **Method memory** lives in skills and supporting references
- **Decision memory** should use the vocabulary defined by **Domain memory**
- **Method memory** should tell contributors how to create and maintain **Domain memory** and **Decision memory**
- The **Architecture overview** should point readers toward the right **Decision memory** when they need rationale or detail
- **Quality signals** should come from automation, not standing narrative docs
- The **Issue tracker** should hold backlog and tech-debt items that need follow-up action
- **Coding conventions** are stable repo rules and should live in a small dedicated reference rather than inside broad contributor guides
- **Design principles** should explain enduring constraints, while ADRs capture concrete trade-offs and exceptions
- **Agent configuration** should stay tiny, explicit, and separate from both narrative docs and skill internals
- **Planning artifacts** should be used sparingly, while the **Issue tracker** remains the canonical backlog
- **Shared references** belong in top-level `docs/references/`, while **Owned references** should live next to their natural owner
- Each **Entry surface** should have a narrow audience and routing job, with minimal overlap
- An **Obsolete doc** should be deleted in the same coordinated change that reroutes every dependency away from it
- **Structural enforcement** should guard the documentation model by checking structure, not by scoring prose
- **Testing conventions** should live in a dedicated slim reference when the repo has stable testing rules worth reusing
- A **Category guide** should exist only for doc categories that need local entry criteria or lifecycle rules

## Example dialogue

> **Dev:** "Should this go into the glossary, an ADR, or a skill?"
> **Domain expert:** "If it's a repo concept, put it in **Domain memory**. If it's a durable trade-off, put it in **Decision memory**. If it's a reusable way of working, put it in **Method memory**."

## Flagged ambiguities

- "docs" was being used to mean multiple kinds of memory — resolved: separate it into **Domain memory**, **Decision memory**, and **Method memory**.
- "architecture" could mean either system structure or decision rationale — resolved: **Architecture overview** is the stable bird's-eye doc, while rationale belongs in **Decision memory**.
- "quality" could mean measurable repo health or a narrative scorecard — resolved: measurable health is a **Quality signal** from automation; narrative backlog tracking belongs in the **Issue tracker**.
- "contribution rules" mixed together stable style rules and procedural advice — resolved: stable naming/style rules are **Coding conventions**; procedural guidance belongs in **Method memory** only when it is truly reusable.
- "design principles" could become either a philosophy dump or a set of real constraints — resolved: keep **Design principles** only for enduring constraints until more of that guidance can move into ADRs or skills.
- Repo-local settings for shared skills could get buried in broad docs — resolved: keep them as **Agent configuration** under `docs/agents/`, small and non-narrative.
- `docs/specs/` and `docs/exec-plans/` could become noisy standing process logs — resolved: keep them only as **Planning artifacts** for genuinely complex, multi-session, or architecture-shaping work, while the **Issue tracker** holds the backlog.
- Top-level references could become a junk drawer — resolved: keep only **Shared references** in `docs/references/`; move **Owned references** next to the module, extension, or skill they document.
- `README.md`, `AGENTS.md`, `docs/README.md`, and `docs/ARCHITECTURE.md` could overlap heavily — resolved: treat each as an **Entry surface** with a narrow audience and routing role.
- Old doc categories could linger as dead weight — resolved: treat them as **Obsolete docs** and remove them in the same change that reroutes docs, skills, and tooling.
- Mechanical checks could become noisy if they judge writing quality — resolved: keep **Structural enforcement** focused on file presence, forbidden files, and allowed placement.
- Testing guidance could get lost between architecture docs and skills — resolved: keep **Testing conventions** in a small dedicated repo-specific doc.
- Separate doc categories could become unclear without local guidance — resolved: keep a **Category guide** only where a category needs usage rules beyond the top-level docs map.
