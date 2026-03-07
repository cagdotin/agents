# Harness-Engineering Alignment Plan (Recommendations Rollup)

Status: Completed  
Owner: repository maintainers  
Created: 2026-03-06
Completed: 2026-03-07

## Context

This plan captures **all recommendations** identified during the harness-engineering review and tracks whether they are complete, in progress, or pending.

Related references:
- [[docs/resources/harness-engineering-openai]]
- [[docs/references/pi-api-reference]]
- [[docs/ARCHITECTURE]]
- [[docs/QUALITY]]

---

## Recommendation Ledger

## R1 — Keep AGENTS.md as a map, not a manual

Status: ✅ complete (phase 1)

Reasoning:
- In an agent-first workflow, large global instruction files crowd out task context.
- A short table-of-contents style file improves retrieval quality and reduces drift.

Implemented:
- Added explicit “Where to Look First” section in [[AGENTS]].
- Points to architecture, quality, references, resources, and extension reference implementation.

---

## R2 — Add architecture system map

Status: ✅ complete (phase 1)

Reasoning:
- Agents and humans need fast orientation: domains, boundaries, runtime data paths, and design intent.
- A single architecture map reduces repeated rediscovery and inconsistent mental models.

Implemented:
- Created [[docs/ARCHITECTURE]] with domain boundaries, principles, and implementation references.

---

## R3 — Add quality scorecard and prioritized gaps

Status: ✅ complete (phase 1)

Reasoning:
- High-throughput agent workflows need explicit quality posture and prioritized next steps.
- A scorecard prevents “invisible debt” and clarifies where to invest attention.

Implemented:
- Created [[docs/QUALITY]] with rubric, component scores, and P0/P1/P2 backlog.

---

## R4 — Add in-repo Pi API quick reference

Status: ✅ complete (phase 1)

Reasoning:
- Core Pi docs are external to this repo; repeated context lookup is costly.
- A focused local reference improves implementation speed and consistency while linking to canonical docs.

Implemented:
- Created [[docs/references/pi-api-reference]].
- Added references index at [[docs/references/README]].

---

## R5 — Restructure external resources knowledge base

Status: ✅ complete (phase 1)

Reasoning:
- External inspiration is only useful if captured as stable, searchable repo artifacts.
- Structured frontmatter and templates preserve consistency and improve discoverability.

Implemented:
- Reworked [[docs/resources/README]] into a capture workflow + schema index.
- Added [[docs/resources/TEMPLATE]] for future resources.

---

## R6 — Fix stale extension docs and ensure README coverage

Status: ✅ complete (phase 1)

Reasoning:
- Missing or shallow extension docs force repeated source archaeology.
- Agent legibility improves when each extension documents triggers, behavior, and requirements.

Implemented:
- Rewrote [[extensions/todos/README]].
- Updated [[extensions/expert/README]].
- Added:
  - [[extensions/tmux-notify/README]]
  - [[extensions/tmux-pane-title/README]]

---

## R7 — Add structural validation for knowledge artifacts

Status: ✅ complete

Reasoning:
- Conventions degrade without mechanical checks.
- Lint-only validation misses documentation/schema quality issues.

Scope:
- Validate required frontmatter fields for resource files.
- Validate SKILL frontmatter completeness.
- Validate extension README presence and minimum content quality.
- Run Biome in the same pipeline.

Implemented:
1. Added `scripts/validate-docs.ts` for resources/skills/extensions checks with actionable failure output.
2. Integrated validation into `bun run check` alongside Biome.
3. Added Lefthook `pre-commit` gate that runs `bun run check`.

Reference:
- API/tooling conventions: [[docs/references/pi-api-reference]]
- Execution plan: [[docs/exec-plans/completed/2026-03-06-pre-commit-quality-gates-lefthook]]

---

## R8 — Decide on prompt-template path strategy (`commands/`)

Status: ✅ complete

Reasoning:
- `package.json` reserved `./commands` as a prompts path but repo had no prompt templates.
- Empty declared resource paths increased ambiguity and maintenance overhead.

Decision:
- Adopted Option B: removed `prompts` path from package manifest until prompt templates actually exist.

Implemented:
- Updated `package.json` Pi manifest to include only existing paths (`skills`, `extensions`, `themes`).
- Updated architecture/reference/quality docs to reflect the manifest contract.

---

## R9 — Expert extension hardening (matching + context budget + UX)

Status: ✅ complete

Reasoning:
- Selective injection only works if domain matching is reliable and context-aware.
- Without budget checks, context can bloat and degrade model performance.

Implemented:
1. Upgraded matching to include aliases, keywords, `scope.patterns` hints, and score thresholding.
2. Added context-budget-aware injection modes (normal/tight/critical) using `ctx.getContextUsage()` and settings thresholds.
3. Added `/expert log` and `/expert init` command flows, including defensive reflection log parsing.
4. Extended expertise metadata support (`keywords`, `aliases`, `related_domains`) and surfaced related-domain hints in injection metadata.

References:
- [[docs/references/pi-api-reference]]
- `.pi/todos` expert TODOs
- [[docs/specs/2026-03-06-r9-expert-extension-hardening]]

---

## R10 — Spec-driven planning for complex upcoming extensions

Status: ✅ complete

Reasoning:
- High-complexity extension work benefits from explicit execution plans and decision logs.
- Specs reduce rework and make intent legible for both humans and agents.

Scope:
- Use `plan` skill for complex planned extensions (subagent/team/safety/orchestration).
- Store generated specs under `docs/specs/` and cross-link from exec plans.

Implemented:
- Added [[docs/specs/2026-03-06-r9-expert-extension-hardening]] as a concrete spec artifact for expert-extension hardening work.
- Added [[docs/specs/2026-03-07-damage-control-extension]] to drive default-on safety guardrails work.
- Upgraded `skills/plan/SKILL.md` to produce **specs and/or execution plans**, including progress-log and decision-log guidance.
- Added `docs/exec-plans/TEMPLATE.md` to standardize plan structure and logging expectations.
- Updated `docs/exec-plans/README.md` to clarify spec-vs-plan responsibilities and recommended workflow.

---

## Execution Order

1. R10 (spec-driven implementation pipeline)

---

## Completion Notes

Exit criteria satisfied:
- ✅ all previously active items resolved,
- ✅ links in [[docs/QUALITY]] updated,
- ✅ resulting implementation/docs reflected in repository planning references.

Final outcomes:
- Added `skills/plan/PLAN.md` as the portable execution-plan standard shipped with the planning skill.
- Updated skill and docs to default medium/large work to spec + plan (unless waived).
- Established template and workflow language for living execution plans.
