# Contributing to Documentation

This file governs how documentation is added, changed, and removed in this repository.
Both human contributors and coding agents should read this before modifying anything
under `docs/`.

---

## Inspiration and Lineage

Our documentation approach draws from specific sources, captured in `docs/resources/`:

| Principle | Origin | Resource |
|-----------|--------|----------|
| ARCHITECTURE.md as a stable codemap, not a code mirror | matklad | [[architecture-md-matklad]] |
| Name entities, don't link them — use search | matklad | [[architecture-md-matklad]] |
| Call out invariants, especially absences | matklad | [[architecture-md-matklad]] |
| AGENTS.md as table of contents, not encyclopedia | OpenAI harness engineering | [[harness-engineering-openai]] |
| Progressive disclosure — small entry point, drill deeper as needed | OpenAI harness engineering | [[harness-engineering-openai]] |
| Repository docs as system of record (not Slack/chat/tribal) | OpenAI harness engineering | [[harness-engineering-openai]] |
| Expertise files as working memory, not source of truth | IndyDevDan | [[agent-experts-indydevdan]] |

When proposing a structural change to docs, check whether it aligns with these
principles. If it intentionally diverges, document the reasoning.

---

## Documentation Map

| File / Directory | Purpose | Stability |
|------------------|---------|-----------|
| `ARCHITECTURE.md` | Codemap, boundaries, invariants | High — update a few times a year |
| `QUALITY.md` | Quality scorecard and prioritized gaps | Medium — update when scores change |
| `CONTRIBUTING-DOCS.md` | This file — rules for docs work | High |
| `exec-plans/` | Active/completed execution plans + debt tracker | Medium — plans are living documents |
| `specs/` | Implementation specs for planned/complex work | Medium — created per feature, archived after |
| `references/` | Internal quick references (Pi API, etc.) | Medium — update when APIs change |
| `resources/` | Curated external resources with frontmatter | Append-only — capture, review, apply |

---

## Rules

### 1. Write for Two Audiences

Every doc is read by humans **and** coding agents. Keep language direct, structure
scannable, and avoid ambiguity. Prefer tables and lists over prose paragraphs.

### 2. Don't Duplicate What Code Already Says

If something is obvious from reading the source — function names, file listings,
export inventories — don't put it in docs. Docs explain **why**, **where**, and
**what's not obvious**. Code explains **how**.

> The test: could someone figure this out in 10 seconds by reading the code?
> Leave it out of docs.

### 3. Name Things, Don't Link Them

Reference important files, types, and modules by name. Do **not** use direct links
or paths that go stale. Readers (human or agent) should use search to find named
entities. This is zero-maintenance and helps discover related things.

**Do**: "The extraction logic lives in `extraction.ts` in the answer extension."
**Don't**: "See [extraction.ts](../extensions/answer/extraction.ts)."

Exception: wikilinks (`[[resource-name]]`) within `docs/resources/` are fine — they
reference sibling documents by stable slug, not filesystem paths.

### 4. Keep ARCHITECTURE.md Stable

ARCHITECTURE.md describes things **unlikely to frequently change**: domain boundaries,
invariants, cross-cutting concerns. Do not add volatile content like lists of current
extensions or skills — those are discoverable with `ls`.

If you need to update ARCHITECTURE.md, ask: "Will this still be true in 6 months?"

### 5. Track Gaps Honestly

Don't write aspirational documentation. If something doesn't exist yet, don't
describe it as if it does. Instead:

- Track quality gaps in `QUALITY.md`
- Track planned work in `exec-plans/` or `specs/`
- Use `.pi/todos/` for actionable items

### 6. Every Resource Gets Frontmatter

External resources captured in `docs/resources/` **must** use the schema defined
in `resources/README.md` and start from `resources/TEMPLATE.md`. Required fields:
`title`, `type`, `source`, `url`, `author`, `date_captured`, `tags`, `status`,
`description`.

### 7. Explain Relevance, Not Just Content

When capturing a resource, the most valuable section is "How This Relates to Our
Repo." A summary of someone else's article is nice; explaining what it means for
*our* decisions is essential.

### 8. Mechanical Validation

Docs are validated by `bun run check:docs` (runs `scripts/validate-docs.ts`).
This checks:

- Frontmatter presence and required fields on resources
- README existence in extension directories

This runs as part of `bun run check` and is enforced by the Lefthook pre-commit hook.
If you add a new doc category that should be validated, update the script.

---

## Removing Documentation

Removing docs requires the same care as removing code. Before deleting:

1. **Check references.** Search for the document name across the repo (AGENTS.md,
   ARCHITECTURE.md, expertise files, other docs). Update or remove references.
2. **Check resources index.** If removing a resource, remove its entry from
   `resources/README.md` index.
3. **Explain why.** The commit message should state why the doc is being removed
   (outdated, merged into another doc, superseded, etc.).

---

## Adding a New Doc Category

If existing categories (`exec-plans`, `specs`, `references`, `resources`) don't fit:

1. Create the directory under `docs/`.
2. Add a `README.md` that explains the category's purpose and any schemas.
3. Update `docs/README.md` (the documentation map).
4. Update `ARCHITECTURE.md` if the category changes the codemap.
5. Consider whether `scripts/validate-docs.ts` should check it.

---

## Style Guide

- **Tooling references**: always use Bun (`bun`, `bun run`, `bunx`).
- **File naming**: `kebab-case.md` for all doc files.
- **Headings**: sentence case ("Cross-cutting concerns", not "Cross-Cutting Concerns").
  Exception: proper nouns and acronyms.
- **Tone**: direct, concise, no filler. Write like you're leaving a note for a
  smart colleague who's in a hurry.
- **Metadata headers**: files that benefit from freshness tracking should include
  `Status:` and `Last updated:` near the top.
