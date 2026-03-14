# Unified memory plugin (tracks + expert) — v0 idea dump

Status: Draft (thinking artifact)
Date: 2026-03-13
Track: `agent-memory`

## Why now

We already shipped:
- track workstream memory (`.pi/tracks/`)
- domain memory (`.pi/expertise/`)
- deep retrieval infra (`qmd`)

The missing piece is **orchestration between layers**, not new storage.

## Desired outcome

A single memory experience for agents/operators that keeps current strengths while reducing friction:
- tracks for initiative-level execution state
- expertise for durable domain knowledge
- qmd for broad markdown retrieval
- explicit promotion flow between them

## Non-goals (v0)

- no OpenViking runtime adoption
- no automatic LLM-driven full-file rewrites
- no hidden autonomous memory mutation loops

## Layer contract (must stay explicit)

- **L0 session**: chat + session trace, ephemeral
- **L1 workstream**: tracks, milestone/report/task state
- **L2 domain**: expertise files, durable scoped insights
- **L3 retrieval**: qmd index, cross-doc recall

Unification should improve UX/orchestration but not blur these boundaries.

## OpenViking-inspired parts to adopt

- tiered memory framing (L0-L3)
- promotion mindset (short-lived → durable)
- retrieval-first behavior before adding more memory

## OpenViking parts to avoid (for now)

- heavy service/runtime stack
- automatic extraction/dedup pipelines with opaque heuristics
- complex orchestration layers before we prove simpler flows

## Candidate architecture options

### Option A — One extension (`memory`)

Create one new extension that internally hosts:
- `workstream` module (today's tracks logic)
- `domain` module (today's expert logic)
- `promotion` module (new)
- `retrieval` adapter (qmd status/guidance hooks)

**Pros**: single UX surface, easier end-to-end flows.
**Cons**: bigger extension, migration complexity.

### Option B — Keep two extensions + shared contract (recommended first)

Keep `tracks` and `expert` separate, add:
- shared schema/types for promotion artifacts
- shared command UX conventions
- lightweight coordinator commands

**Pros**: lower migration risk, incremental rollout.
**Cons**: two extension boundaries remain visible.

## Promotion flow (v1 proposal)

Manual-first, explicit, small steps:

1. Capture finding in track (`findings.md` / `decisions.md`).
2. Promote durable domain insight via `expertise append`.
3. Ensure durable docs/specs are indexable by qmd.
4. Track references link to promoted domain entries.

Optional later:
- assisted suggestion command (`/memory suggest-promotions`) that proposes candidates but never auto-writes.

## UX sketch

Possible command family:
- `/memory status` — layered status snapshot (L1/L2/L3)
- `/memory promote` — guided promotion from current track notes to expertise append draft
- `/memory map` — show domain ↔ track touchpoints

Could be implemented as wrappers around existing `track` + `expertise` tool actions initially.

## Risks to watch

- duplication between L1 and L2 content
- stale promoted knowledge if no review cadence
- over-automation reintroducing noisy/low-signal memory writes

## First practical milestone

1. Define promotion schema (what qualifies for L2).
2. Add tiny helper workflow (command or doc-driven checklist).
3. Pilot on one real workstream and measure:
   - fewer repeated explanations
   - lower context overhead
   - better recall speed

## Questions for training/discussion

1. What exact criteria make a finding "domain-durable" vs "track-local"?
2. Should promotion be one-way (L1→L2), or allow explicit demotion/cleanup?
3. Should unified UX land as wrappers first, then optional extension merge?
4. What review cadence keeps expertise high-signal without reintroducing heavy reflection?
