# Context/ADR methodology adoption across repos

Status: Draft
Date: 2026-04-30
Execution plan: [[docs/exec-plans/active/2026-04-30-context-adr-methodology-adoption.md]]

## 1. Problem statement

This package is the main shared agent config that propagates to many repositories. We want to adopt the stronger methodology pattern seen in Matt Pocock's skills repo:

- repo-local domain vocabulary via `CONTEXT.md` / `CONTEXT-MAP.md`
- long-lived architectural decision memory via `docs/adr/`
- skills that actively read and maintain those artifacts during planning, diagnosis, architecture work, and issue workflow

The package already contains some of the required building blocks (`plan`, `review`, `improve-codebase-architecture`, `github`, `browser`, productivity skills), but it does not yet ship the full skill set needed to make that methodology work consistently across downstream repos.

## 2. Goals and non-goals

### 2.1 Goals

- Identify the missing skills and support artifacts required for effective cross-repo use of the methodology.
- Distinguish between skills that can be imported nearly verbatim and skills that should be adapted to this package's conventions.
- Recommend a phased adoption path.
- Define how the methodology should fit with this repo's existing `docs/specs/` + `docs/exec-plans/` system.

### 2.2 Non-goals

- Implement the missing skills in this document.
- Force every downstream repo to use GitHub issues or a single issue tracker.
- Replace `docs/specs/` or `docs/exec-plans/` with PRDs or ADRs.

## 3. Current baseline

### Already present in this package

- `skills/engineering/improve-codebase-architecture`
- `skills/engineering/plan`
- `skills/engineering/review`
- `skills/tools/github`
- `skills/tools/browser`
- `skills/tools/youtube-transcript`
- productivity skills for grilling and communication

### Missing from Matt's engineering methodology set

- `grill-with-docs`
- `setup-matt-pocock-skills` equivalent
- `diagnose`
- `tdd`
- `to-issues`
- `to-prd` or local equivalent
- `triage`
- `zoom-out`

## 4. Recommended skill set

### 4.1 Essential foundation

1. **`grill-with-docs`**
   - Why: this is the live workflow that makes `CONTEXT.md` and ADRs operational instead of passive docs.
   - Fit: high. It complements `grill-me` and `improve-codebase-architecture`.
   - Priority: P0.

2. **`setup-repo-methodology`** (adapted from `setup-matt-pocock-skills`)
   - Why: downstream repos need a bootstrap step that teaches the shared skills where issue tracking lives, how triage labels map, and where context/ADR docs should live.
   - Fit: must be adapted to this package's `AGENTS.md`-first culture and multi-repo portability.
   - Priority: P0.

3. **`zoom-out`**
   - Why: lightweight but important. It gives a standard way to request a higher-level codemap using domain vocabulary.
   - Fit: nearly direct import.
   - Priority: P0.

### 4.2 Core engineering execution

4. **`diagnose`**
   - Why: operationalizes disciplined debugging using domain glossary + ADR awareness.
   - Fit: strong. Complements `review` and `improve-codebase-architecture`.
   - Priority: P1.

5. **`tdd`**
   - Why: gives a standard implementation discipline that aligns well with deep modules and interface-first design.
   - Fit: good, but should acknowledge this package's existing testing and spec/plan conventions.
   - Priority: P1.

### 4.3 Issue-tracker workflow layer

6. **`triage`**
   - Why: needed if downstream repos want the full issue-state-machine workflow.
   - Fit: useful, but requires issue-tracker abstraction and probably tighter integration with `skills/tools/github`.
   - Priority: P1.

7. **`to-issues`**
   - Why: turns specs/plans into thin vertical-slice issues.
   - Fit: strong for repos that use issue trackers heavily.
   - Priority: P1.

### 4.4 Optional / adapt heavily

8. **`to-prd` vs local equivalent**
   - Recommendation: do not import verbatim as the primary path.
   - Reason: this package already centers `docs/specs/` and `docs/exec-plans/` rather than PRDs as the canonical planning artifact.
   - Better fit: create a local equivalent later if needed, such as `to-spec` or `issue-to-spec`, or teach `to-issues` to consume our existing specs directly.
   - Priority: P2.

## 5. Support artifacts needed alongside skills

To make the methodology actually usable across downstream repos, the package should also define conventions for:

- `CONTEXT.md` template
- `CONTEXT-MAP.md` template
- `docs/adr/` conventions and numbering
- repo-local agent configuration docs such as `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, and `docs/agents/domain.md`
- guidance on when to use `CONTEXT.md` / ADRs vs `docs/specs/` / `docs/exec-plans/`

## 6. Recommended adaptations for this package

### 6.1 Do not copy the bootstrap skill name directly

`setup-matt-pocock-skills` is too upstream-branded for a shared package. Replace it with something like:

- `setup-repo-methodology`
- `setup-agent-methodology`
- `setup-context-and-adr-workflow`

### 6.2 Keep `specs` and `exec-plans`

The local methodology should be additive:

- `CONTEXT.md` = domain language
- `docs/adr/` = durable architecture decisions
- `docs/specs/` = feature or initiative design contract
- `docs/exec-plans/` = execution state and rollout log

### 6.3 Prefer issue-tracker abstraction over GitHub-only assumptions

Because this package propagates to many repos, issue workflow skills should support:

- GitHub via `gh`
- local markdown issue tracking fallback
- room for future adapters such as GitLab, Linear, or Jira

## 7. Proposed phased rollout

### Phase 1 — foundation

- add `grill-with-docs`
- add adapted setup skill
- add `zoom-out`
- add support templates for `CONTEXT.md`, `CONTEXT-MAP.md`, and ADR docs

### Phase 2 — execution discipline

- add `diagnose`
- add `tdd`

### Phase 3 — issue workflow

- add `triage`
- add `to-issues`
- decide whether a `to-prd` replacement is needed or whether our `plan` skill already fills that role sufficiently

## 8. Acceptance criteria for the methodology

The methodology is effectively supported when a downstream repo can:

- bootstrap context + ADR + issue-tracker settings with one setup skill
- run a design grilling session that updates `CONTEXT.md` and optionally ADRs
- diagnose bugs using context-aware debugging discipline
- request architectural improvements using shared vocabulary
- zoom out on unfamiliar code using shared vocabulary
- break approved specs/plans into vertical-slice issues
- triage issue queues using a stable state machine where applicable

## 9. Open questions

- Should `triage` and `to-issues` live under `skills/tools/` or `skills/engineering/`? Current recommendation: `engineering`, because they are workflow methodologies rather than direct system operators.
- Should we introduce a local `to-spec` skill instead of `to-prd`? Current recommendation: probably yes, if we later find a gap that `skills/engineering/plan` does not already cover.
