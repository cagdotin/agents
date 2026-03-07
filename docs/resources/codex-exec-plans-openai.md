---
title: "Codex Execution Plans"
type: article
source: openai-cookbook
url: https://developers.openai.com/cookbook/articles/codex_exec_plans
author: OpenAI
date_captured: 2026-03-07
tags:
  - codex
  - execution-plans
  - planning
  - agent-workflow
  - progress-logging
related:
  - "[[harness-engineering-openai]]"
status: applied
impact: foundational
description: >
  Practical guidance for using execution plans as living implementation artifacts:
  define scope and milestones up front, then continuously append progress,
  decisions, and blockers so long-running agent work stays auditable and steerable.
---

# Codex Execution Plans

## Summary

This guide frames execution plans as the operational complement to specs:
- specs define the intended design contract
- execution plans track real implementation progress over time

The article emphasizes that plans should be **updated during execution**, not just written once.

## Key Ideas

- Treat execution plans as living documents, not static proposals.
- Keep scope explicit (in/out) to prevent drift in autonomous or semi-autonomous runs.
- Break work into checkable milestones to preserve momentum and enable handoffs.
- Append progress and decision logs so reviewers can reconstruct "what happened" quickly.
- Record blockers and mitigation plans early instead of burying them in chat context.

## Extracted Links and Context

| Link | Context |
|------|---------|
| <https://developers.openai.com/cookbook/articles/codex_exec_plans> | Canonical guidance for execution-plan workflow with Codex/OpenAI agents. |

## How This Relates to Our Repo

- Reinforces the separation we use between `docs/specs/` (design) and `docs/exec-plans/` (execution state).
- Supports the `skills/plan` workflow that generates both specs and execution plans.
- Justifies adding progress/decision logging structure and completion protocol in plan templates.

## Actionable Follow-Ups

- [x] Adopt this format as default for medium/large extension initiatives (with explicit waive option).
- [x] Require active plans to maintain progress/decision/discovery/outcome sections during implementation.
- [ ] Periodically move completed plans from `active/` to `completed/` with outcome links.

## Notes Worth Keeping

- Execution plans only work if they are maintained during implementation, not authored once and forgotten.
- Scope boundaries + milestone checkpoints are key controls against drift in agent-driven execution.

---

Capture notes: captured from canonical OpenAI Cookbook article link; this repo entry summarizes planning patterns and their repository implications.
