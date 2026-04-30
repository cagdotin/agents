# Agents package

This context defines the repo-specific language for a shared Pi package of extensions, skills, themes, and support methodology used by coding agents. It intentionally excludes generic document types and conventions that agents can discover through the repo's entry surfaces and search.

## Language

**Pi package**:
A versioned bundle of extensions, skills, themes, and support docs distributed together to coding agents.
_Avoid_: repo config, toolkit, agent setup

**Extension**:
Runtime code loaded by Pi that adds behavior such as tools, commands, hooks, or conditional resource exposure.
_Avoid_: skill, helper doc, script

**Skill**:
An on-demand markdown instruction bundle that teaches an agent how to perform a class of work.
_Avoid_: extension, command, runtime feature

**Package skill**:
A skill discovered from top-level `skills/` and available across repositories that install this package.
_Avoid_: extension-owned skill, repo-local note

**Extension-owned skill**:
A skill shipped with an extension and exposed only when that extension's runtime conditions are met.
_Avoid_: package skill, always-on skill

**Domain memory**:
The canonical vocabulary of a repository's problem space and concepts.
_Avoid_: glossary dump, repo map, implementation notes

**Decision memory**:
The durable record of meaningful architecture or scope choices.
_Avoid_: implementation diary, random notes, tribal knowledge

**Method memory**:
The reusable operating guidance that tells agents how work should be done across repos.
_Avoid_: one-off reminders, contributor chatter, implementation detail

**Agent configuration**:
The repo-local settings that shared skills need in order to behave correctly in a specific repository.
_Avoid_: narrative docs, broad contribution guidance, architecture explanation

**Planning artifact**:
An active design or execution record used only for genuinely complex, multi-session, or architecture-shaping work.
_Avoid_: routine task note, default backlog, permanent status ledger

**Shared reference**:
A stable repo-wide reference that applies across multiple skills, modules, or workflows without one narrow owner.
_Avoid_: module note, skill-local cheat sheet, junk drawer reference

**Owned reference**:
A reference that belongs next to the skill, module, or extension it explains, even when reused widely.
_Avoid_: detached top-level reference, catch-all note

## Relationships

- A **Pi package** distributes **Extensions**, **Package skills**, themes, and support docs together
- An **Extension** may expose one or more **Extension-owned skills**
- **Method memory** lives primarily in **Skills** and supporting references
- **Domain memory** lives in `CONTEXT.md`
- **Decision memory** lives in ADRs and active **Planning artifacts**
- **Agent configuration** lives under `docs/agents/`
- **Shared references** belong in top-level `docs/references/`, while **Owned references** live next to their natural owner
- **Planning artifacts** are active working context, not backlog

## Example dialogue

> **Dev:** "Should this guidance live in a top-level skill or inside an extension?"
> **Domain expert:** "If it should always be available across repos, make it a **Package skill**. If it only makes sense when an extension detects its environment, make it an **Extension-owned skill**."
