# Documentation Map

This directory is the system-of-record knowledge base for this repository.

Tooling policy: examples and commands in docs should use **Bun** (`bun`, `bun run`, `bunx`).

## Files

- `ARCHITECTURE.md` — codemap, boundaries, invariants, and cross-cutting concerns
- `DESIGN-PRINCIPLES.md` — design principles distilled from research and practice
- `QUALITY.md` — quality scorecard and prioritized improvement backlog
- `CONTRIBUTING-DOCS.md` — rules for adding, changing, or removing documentation
- `exec-plans/` — active/completed plans and debt tracker
- `specs/` — implementation specs for planned/complex work
- `references/` — internal quick references (implementation-facing)

## Reading Order

| Doc | When to read | What it answers |
|---|---|---|
| `ARCHITECTURE.md` | First time in this repo, or when lost | What's here, where things live, what the boundaries are |
| `DESIGN-PRINCIPLES.md` | Before writing or planning any code changes | How we write code, the principles we live by |
| `CONTRIBUTING-DOCS.md` | Before modifying any documentation | Rules for doc structure, naming, and placement |
| `QUALITY.md` | When looking for what to improve next | Current quality state, prioritized gaps |
| `exec-plans/README.md` | When starting medium+ work | Active plans, debt tracker, planning workflow |
| `references/pi-api-reference.md` | When building Pi extensions or tools | Pi SDK surface, hook points, registration patterns |
