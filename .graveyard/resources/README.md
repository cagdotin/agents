# Retired: Resource Analyses

Moved: 2026-03-23

These resource analyses were migrated to the vault (`0xcgn/vault`) where they
live as properly connected source notes with wiki-links, cross-references, and
connections to original insight notes.

## Why moved

- The vault is the system of record for knowledge and research
- Full analyses were too detailed for this repo's needs
- Actionable principles were distilled into `docs/DESIGN-PRINCIPLES.md`
- Avoids duplicate knowledge that drifts apart

## Where they live now

Vault locations:
- `00 - sources/youtube/` — video analyses (Dex, IndyDevDan, Cognee, Matt Pocock)
- `00 - sources/articles/` — article analyses (matklad, OpenAI, Unix philosophy)
- `03 - notes/agentic coding.md` — MOC connecting all sources and insights

## What replaced them here

`docs/DESIGN-PRINCIPLES.md` — the 7 actionable design principles distilled
from these resources, with source attribution. This is what agents need when
working in this repo.

## Future

When QMD cross-collection search is operational, agents in this repo will be
able to query the vault's full analyses directly via `qmd query -c vault`.
