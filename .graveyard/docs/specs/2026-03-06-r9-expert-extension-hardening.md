# R9 — Expert Extension Hardening (Matching, Context Budget, UX)

Status: Draft
Todo:
- TODO-07388ec8 (matching)
- TODO-a48d2d97 (context budget)
- TODO-6087997f (UX)
Date: 2026-03-06

## 1. Problem Statement

`extensions/expert` already provides high-value domain memory, but three gaps reduce reliability in real-world usage:

1. **Matching precision is shallow**
   - `match_domains_to_prompt()` is mostly keyword overlap and path fragment matching.
   - `scope.patterns` exists in types/storage but is not used in matching.
   - Result: false negatives (missed domains) and weaker auto-injection.

2. **Injection is not context-budget-aware**
   - `before_agent_start` injects expertise without checking `ctx.getContextUsage()`.
   - Near the model’s context limit, this can worsen compaction pressure or degrade response quality.

3. **Operator UX has known friction**
   - Reflection logs exist (`.pi/expertise/.reflections.log`) but have no command surface.
   - Domain bootstrapping is tool-only (`expertise init`) instead of accessible via `/expert` command.

> **Important boundary:** This spec hardens `extensions/expert` behavior and command UX. It does **not** redesign the reflection model strategy or migrate `llm.ts` invocation architecture.

## 2. Goals and Non-Goals

### 2.1 Goals

- Improve domain matching quality with explicit metadata (`keywords`, `aliases`) and `scope.patterns` support.
- Make expertise injection adaptive to context usage (`ctx.getContextUsage()`), with deterministic fallback behavior.
- Add `/expert log` and `/expert init` command flows for direct operator control.
- Keep backward compatibility with existing expertise YAML files.
- Keep failure messages actionable and predictable.

### 2.2 Non-Goals

- Rewriting reflection prompts/pipeline behavior.
- Adding automatic reflection on every turn.
- Building a full-screen log browser UI; command+notify level UX is sufficient for this phase.
- Introducing heavy dependencies for matching unless clearly necessary.

## 3. System Context

Primary files/modules affected:

- `extensions/expert/types.ts`
- `extensions/expert/storage.ts`
- `extensions/expert/helpers.ts`
- `extensions/expert/hooks.ts`
- `extensions/expert/index.ts`
- `extensions/expert/constants.ts`
- `extensions/expert/README.md`

Secondary touchpoints:

- `docs/QUALITY.md` (after implementation)
- `docs/exec-plans/completed/2026-03-06-harness-alignment-plan.md` (status updates)

Current flow impacted:

1. `before_agent_start` loads settings + domains (`hooks.ts`)
2. `match_domains_to_prompt()` scores domains (`helpers.ts`)
3. Selected expertise YAML is appended to system prompt (`hooks.ts`)
4. `/expert` command routes subcommands (`index.ts`)

## 4. Domain Model

### 4.1 Expertise Header (extended, backward-compatible)

Add optional fields to domain metadata:

```yaml
domain: expert-extension
description: "..."
last_synced: "..."
scope:
  paths:
    - extensions/expert/
  patterns:
    - "extensions/expert/**/*.ts"
keywords:
  - expertise
  - reflection
aliases:
  - expert
  - domain memory
related_domains:
  - extensions-dev
```

#### Field semantics

- `scope.paths` (existing): path-prefix matching, strongest scope signal.
- `scope.patterns` (existing-but-unused): glob-like file matching and optional prompt hints.
- `keywords` (new): domain terms likely to appear in prompts/issues.
- `aliases` (new): alternate names/phrases for the domain.
- `related_domains` (new): low-cost cross-domain hints; does not imply auto-loading by default.

### 4.2 Context Injection Policy (settings)

Extend `.pi/expertise/settings.json` with optional limits:

- `max_context_percent_for_auto_inject` (default: `80`)
- `max_context_percent_for_any_inject` (default: `92`)

Compatibility rule: missing fields use defaults.

## 5. Detailed Design

### 5.1 Matching Engine v2

#### 5.1.1 Prompt-to-domain scoring

Enhance `match_domains_to_prompt()` scoring inputs:

- exact domain name mention
- alias mention
- keyword overlap
- description overlap (existing)
- `scope.paths` mention (existing)
- `scope.patterns` basename hints (new)

Proposed weighting (initial):

- domain exact mention: +10
- alias match: +8
- scope path explicit mention: +8
- scope pattern basename/path hint: +6
- keyword match: +4 each unique
- description word overlap: +2 each unique

Apply minimum score threshold (`>= 6`) to reduce weak matches.

#### 5.1.2 File-to-domain matching for reflection/helper flows

Enhance `match_files_to_domains()` to include `scope.patterns` glob checks in addition to `scope.paths` prefix checks.

Implementation approach:
- Add small internal glob matcher utility (`*`, `**`, `?`) in `helpers.ts`, path-normalized to `/`.
- Avoid adding external dependencies unless matching complexity justifies it.

#### 5.1.3 Related-domain hints

When a domain is selected/injected, expose related domain names in injection metadata as a **hint only**.
No automatic cascade injection in this phase.

### 5.2 Context-Budget-Aware Injection

In `hooks.ts` `before_agent_start`:

1. Read `ctx.getContextUsage()`.
2. Evaluate `usage.percent` with deterministic modes:
   - **Normal mode** (`percent < max_context_percent_for_auto_inject`): existing behavior.
   - **Tight mode** (`max_context_percent_for_auto_inject <= percent < max_context_percent_for_any_inject`):
     - inject pinned domains only
     - skip auto-matched domains
   - **Critical mode** (`percent >= max_context_percent_for_any_inject`):
     - skip all expertise injection
     - emit user-visible status message explaining skip reason.
3. If `usage` or `usage.percent` is unavailable, default to normal mode (current behavior).

Keep deterministic, non-surprising behavior; do not trigger compaction automatically in this scope.

### 5.3 `/expert` UX Additions

#### 5.3.1 `/expert log [domain] [--limit N]`

Add log viewing command for `.reflections.log`:

- `/expert log` → recent entries across domains (default limit 20)
- `/expert log <domain>` → filtered by domain
- `/expert log <domain> --limit 50` → custom limit with sane max clamp

Implementation:
- Add log parsing helper in `storage.ts` (split YAML docs by `---`, parse with existing YAML lib).
- Sort by `date` descending.
- Render concise list via `ctx.ui.notify()` (sufficient for phase 1).

#### 5.3.2 `/expert init <domain> <scope_path> [--description "..."]`

Add command-level bootstrap path:

- validate domain name (reuse existing validator)
- reject existing domain collisions
- create skeleton YAML via existing `build_skeleton_yaml`
- persist and notify next steps

Defaults:
- if `--description` omitted, generate temporary description from domain and include warning to refine.

### 5.4 Optional polish bundled with R9 (low risk)

- Add expand key-hint in collapsed `expertise` tool render cases where detail exists.
- Keep existing compact rendering defaults.

## 6. Error Handling and Failure Modes

### `invalid_domain_name`
- Trigger: `/expert init` receives invalid slug.
- Handling: notify usage + expected format.

### `domain_exists`
- Trigger: init on existing domain.
- Handling: reject with actionable “use update”/“choose another name” guidance.

### `settings_invalid`
- Trigger: bad numeric thresholds in settings.
- Handling: normalize/clamp to defaults; do not crash.

### `context_usage_unavailable`
- Trigger: `ctx.getContextUsage()` returns undefined/null percent.
- Handling: fallback to normal injection mode.

### `reflection_log_parse_error`
- Trigger: malformed log segment.
- Handling: skip invalid entry, continue parsing, report partial-read warning when applicable.

### `pattern_compile_error`
- Trigger: malformed glob pattern.
- Handling: ignore invalid pattern and continue; log lightweight warning in debug output.

## 7. Security and Safety Considerations

- Treat all YAML/log file content as untrusted input; parse defensively.
- Never execute pattern contents; matching must be pure string/path evaluation.
- Ensure command parsing cannot escape expected file roots (reuse existing expertise dir resolution).
- Avoid leaking full reflection transcript in `/expert log`; show only summary metadata.

## 8. Testing Strategy

### 8.1 Unit-Level Checks (recommended)

- `match_domains_to_prompt()` scoring with keywords/aliases/pattern signals.
- `match_files_to_domains()` path+pattern coverage.
- context policy branching logic (normal/tight/critical/unavailable).
- reflection log parser handling valid + malformed entries.

### 8.2 Integration/Manual Validation

- Run `bun run check`.
- Use `/expert chat`, `/expert reflect`, `/expert log`, `/expert init` in a real session.
- Simulate context thresholds by mocking `ctx.getContextUsage()` return values in a dev harness.
- Verify no regressions in existing auto-injection and pinned-domain behavior.

## 9. Implementation Checklist

- [x] Extend expertise metadata types (`keywords`, `aliases`, `related_domains`) in `types.ts`.
- [x] Parse and persist new header metadata in `storage.ts` (backward-compatible).
- [x] Implement `scope.patterns` matching support in `helpers.ts`.
- [x] Upgrade prompt-domain scoring to include keywords/aliases/pattern hints.
- [x] Add context-budget policy settings and normalization in `constants.ts`/`storage.ts`.
- [x] Apply context-aware injection branching in `hooks.ts`.
- [x] Add reflection log read/parse helpers in `storage.ts`.
- [x] Implement `/expert log` command handling in `index.ts`.
- [x] Implement `/expert init` command handling in `index.ts`.
- [x] (Optional) Add collapsed-view expand hints in `tool.ts`.
- [x] Update `extensions/expert/README.md` with new metadata + commands.
- [x] Update quality/exec-plan docs to mark R9 progress.

## 10. Open Questions

1. **Should `related_domains` auto-load or remain hint-only?**
   - Recommendation: hint-only for this phase to avoid hidden context growth.

2. **What should tight-mode injection include besides pinned domains?**
   - Recommendation: pinned-only in tight mode for deterministic behavior; revisit after usage telemetry.

3. **Do we need a richer TUI browser for logs now?**
   - Recommendation: no. Start with command output; add UI browser only if usage proves pain.
