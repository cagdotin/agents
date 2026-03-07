# Pre-Commit Quality Gates with Lefthook

Status: Completed  
Owner: repository maintainers  
Created: 2026-03-06

## Context

This plan operationalizes recommendation R7 from
[[docs/exec-plans/completed/2026-03-06-harness-alignment-plan]] by introducing
**Lefthook-enforced pre-commit gates**.

Primary references:
- [[docs/resources/harness-engineering-openai]]
- [[docs/references/pi-api-reference]]
- [[docs/QUALITY]]

---

## Problem Statement

Current quality checks are optional/manual (`bun run check`). In high-throughput,
agent-assisted workflows, optional checks drift and regressions slip into history.

We need a **local, deterministic, always-on pre-commit quality gate** to ensure:

1. baseline code quality (Biome)
2. documentation metadata quality (resource/skill validation)
3. extension documentation baseline (README coverage and non-triviality)

---

## Goals

1. Enforce pre-commit checks consistently across contributors and agent sessions.
2. Make gate behavior explicit, versioned, and easy to reason about.
3. Keep checks fast enough for normal commit loops.
4. Fail with clear, actionable messages.

## Non-Goals

1. Replacing CI entirely (CI can still be added later).
2. Running long integration/e2e tests in pre-commit.
3. Enforcing every style choice in hook logic itself (hook should orchestrate existing check commands).

---

## Why Lefthook (Design Reasoning)

Chosen over ad-hoc git hooks or Husky because:

- declarative hook config in repo
- fast execution model and parallelism support
- language/toolchain agnostic (works cleanly with Bun/Node workflows)
- lower incidental complexity than custom shell-hook scripts

This aligns with harness-engineering principles: **mechanize invariants** and keep
quality enforcement in-repo.

---

## Proposed Design

## 1) Hook Orchestrator

Add Lefthook config (`lefthook.yml`) with `pre-commit` pipeline.

Initial pre-commit commands:
1. `biome` check (`bun run check` or equivalent split command)
2. docs/metadata validator script (new)

## 2) Validation Script Layer

Add a repo script (proposed: `scripts/validate-docs.ts`) that validates:

- `docs/resources/*.md` required frontmatter fields
- `skills/*/SKILL.md` required frontmatter fields
- `extensions/*/README.md` existence and minimum content threshold

Output format should be concise and actionable (file + missing field + fix hint).

## 3) Command Contract

Normalize check commands so the same contract runs in both hook and CI contexts:

- `bun run check` (or split checks aggregated by this command)

Lefthook should call stable bun scripts rather than duplicating command details.

---

## Rollout Plan

## Phase A — Scaffold

- [x] Add Lefthook dependency/config files.
- [x] Add install bootstrap documentation (`lefthook install`).
- [x] Wire `pre-commit` to current `bun run check`.

## Phase B — Expand quality gates

- [x] Implement `scripts/validate-docs.ts`.
- [x] Integrate validator into `bun run check` pipeline.
- [x] Ensure hook failure messages are actionable.

## Phase C — Stabilize

- [x] Measure runtime and trim slow checks if needed. *(current local run ~0.1s on this repo via `lefthook run pre-commit --all-files`)*
- [x] Document troubleshooting in README/docs.

---

## Risks and Mitigations

1. **Risk:** Hook not installed on some machines.
   - Mitigation: explicit setup docs + optional install script check.

2. **Risk:** Hooks too slow, contributors bypass them.
   - Mitigation: keep pre-commit checks lightweight and deterministic.

3. **Risk:** Duplicate logic between hook and CI.
   - Mitigation: centralize in bun scripts; hooks/CI only call the script contract.

---

## Deliverables

1. `lefthook.yml` (repo-managed hook config)
2. docs update describing setup and expected hook behavior
3. `scripts/validate-docs.ts`
4. updated `package.json` check pipeline

---

## Exit Criteria

This plan moves to `completed/` when:

- pre-commit hook runs automatically via Lefthook,
- required quality checks are enforced locally,
- quality validation scope is reflected in [[docs/QUALITY]],
- and related references are updated (architecture/quality docs).
