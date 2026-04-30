# Domain docs

How shared engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you are about to work in. In multi-context repos, also check context-local ADR directories when they exist.

If any of these files do not exist, proceed silently. Do not flag their absence and do not suggest creating them up front. Producer skills like `grill-with-docs` create them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `CONTEXT-MAP.md` at the root):

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, that is a signal — either you are inventing language the project does not use, or there is a real glossary gap worth capturing later with `grill-with-docs`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly instead of silently overriding it.

Example:

> _Contradicts ADR-0007 — but worth reopening because..._
