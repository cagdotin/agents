# Domain docs

How shared engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you are about to work in

If any of these files do not exist, proceed silently. Do not flag their absence and do not suggest creating them up front. Producer skills like `grill-with-docs` create them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-example-decision.md
└── src/
```

If this repo later adopts a multi-context layout, update this file and `AGENTS.md` accordingly.

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, that is a signal — either you are inventing language the project does not use, or there is a real glossary gap worth capturing later with `grill-with-docs`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly instead of silently overriding it.
