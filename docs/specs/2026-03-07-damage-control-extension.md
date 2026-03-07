# Damage Control Extension — Default Safety Guardrails for YOLO Mode

Status: Approved (v1)
Todo: TODO-a89dd8a0
Date: 2026-03-07

## 1. Problem Statement

This repository intentionally runs Pi in a fast, low-friction workflow (YOLO mode). That speed is valuable, but without policy enforcement it leaves a high blast radius for destructive tool calls (filesystem wipes, git history destruction, cloud resource deletion, SQL data loss, secret exposure).

The project needs a **default-on safety layer** that intercepts tool execution and enforces configurable guardrails before damage happens.

Desired end state:
- Damage-control is always active when this package is loaded.
- Safety rules are composable from bundled defaults + global user config + project-local config.
- Dangerous actions are blocked or explicitly confirmed (ask mode) with clear user feedback.
- Decisions are auditable in session history.

> **Important boundary:** This spec covers a single extension for runtime tool-call safety enforcement. It does **not** cover expert-extension integration (e.g., expertise-declared protected paths); that is explicitly deferred as a future enhancement.

## 2. Goals and Non-Goals

### 2.1 Goals

- Provide a `damage-control` extension under `extensions/` that enforces policy via `tool_call` hooks.
- Make the extension **default behavior** for this package (no opt-in ceremony required).
- Support layered rule sources:
  1. Bundled default rules in the extension
  2. Global rules (`~/.pi/agent/damage-control-rules.yaml`)
  3. Project rules (`.pi/damage-control-rules.yaml`, discovered from cwd/ancestors)
- Enforce path tiers:
  - `zero_access_paths` (no read/write/edit/search access)
  - `read_only_paths` (read/search allowed, mutation blocked)
  - `no_delete_paths` (deletion/move blocked)
- Enforce regex-based bash safety patterns with `block` and `ask` actions.
- Fail safely in no-UI environments for `ask` rules (deny by default).
- Persist violation outcomes in session entries for auditability.
- Provide operator-visible status/notifications for active policy and violations.

### 2.2 Non-Goals

- Integrating with `extensions/expert` metadata in v1.
- Building a full policy DSL (priorities, conditional expressions, per-agent routing) in v1.
- Replacing Pi core permission systems; this remains an extension-level guardrail.
- Shipping cloud-provider-perfect command parsing; initial bash analysis is rule-driven + heuristic.

## 3. System Context

Primary new module:

```text
extensions/damage-control/
├── index.ts                # extension entry: hook registration + startup status
├── constants.ts            # file names, defaults, status keys, hard safety strings
├── types.ts                # rule schema, normalized rules, violation/result types
├── rules-loader.ts         # load + parse + merge bundled/global/project rules
├── matcher.ts              # path/glob matching + bash command checks
├── policy.ts               # tool-call policy evaluator
├── default-rules.yaml      # curated baseline rule set (bundled)
└── README.md               # behavior/configuration docs
```

Integration points:
- Pi hook: `session_start` (load/normalize rules, set status)
- Pi hook: `tool_call` (evaluate and return `{ block, reason }` when needed)
- Session audit trail: `pi.appendEntry("damage-control-log", ...)`
- User feedback: `ctx.ui.notify`, `ctx.ui.setStatus`, `ctx.ui.confirm`

Related docs to update after implementation:
- `docs/ARCHITECTURE.md` (extension list)
- `docs/QUALITY.md` (scorecard/gap updates)
- `docs/exec-plans/active/2026-03-06-harness-alignment-plan.md` (R10 progress linkage)

## 4. Domain Model

### 4.1 Rule File Schema (YAML)

```yaml
version: 1
bash_tool_patterns:
  - id: git-reset-hard
    pattern: '\\bgit\\s+reset\\s+--hard\\b'
    reason: git reset --hard discards uncommitted changes
    action: block # block | ask

zero_access_paths:
  - .env
  - ~/.ssh/

read_only_paths:
  - package-lock.json
  - dist/

no_delete_paths:
  - README.md
  - .git/
```

Schema notes:
- `id` optional but recommended for stable diagnostics and dedupe.
- `action` defaults to `block` when omitted.
- Unknown top-level fields are ignored (warn once per source).

### 4.2 Normalized Runtime Rule Set

At runtime, rules are normalized into an internal structure with:
- compiled regex objects (for bash patterns)
- normalized path patterns (slash-normalized, source-tagged)
- provenance metadata (`bundled`, `global`, `project`)

### 4.3 Layered Sources and Merge Contract

Sources are loaded in this order:
1. `bundled`: `extensions/damage-control/default-rules.yaml`
2. `global`: `~/.pi/agent/damage-control-rules.yaml`
3. `project`: nearest `.pi/damage-control-rules.yaml` discovered by walking up from `ctx.cwd`

Merge strategy (v1):
- **Additive append** across layers.
- Deduplicate identical entries by stable signature (`id` when present, else normalized value).
- No explicit remove/override semantics in v1.

## 5. Detailed Design

### 5.1 Rule Discovery and Loading

On `session_start`:
1. Resolve and read bundled defaults.
2. Resolve and read global rules (if file exists).
3. Discover project rules by upward search and read first applicable file.
4. Parse YAML, validate shape, normalize values, compile regex.
5. Merge normalized layers.
6. Cache active rules in memory and expose summary in status line.

Discovery boundary recommendation:
- Walk from `ctx.cwd` upward until git root (fallback: filesystem root if not in a git repo), then stop.

### 5.2 Policy Evaluation Order

For each `tool_call` event:
1. Build a tool-specific candidate target set:
   - `read/write/edit/find/ls/grep`: use `input.path` and related path fields (plus `grep.glob`).
   - `bash`: evaluate command against pattern rules; perform path-reference heuristics for path tiers.
2. Check `zero_access_paths` first (hard deny).
3. Check `bash_tool_patterns` (block/ask).
4. Check `read_only_paths` for mutating operations.
5. Check `no_delete_paths` for delete/move operations.
6. On first violation, emit enforcement outcome and stop evaluation.

### 5.3 Enforcement Outcomes

#### `block`
- Return `{ block: true, reason: <policy message> }`.
- Notify user and update status when UI exists.
- Append audit entry with action `blocked`.

#### `ask`
- If `ctx.hasUI`:
  - prompt confirmation via `ctx.ui.confirm(...)` (30s timeout).
  - approved => allow + audit `confirmed_by_user`
  - denied/timeout => block + audit `blocked_by_user`
- If no UI:
  - fail closed: block with reason `ask rule requires confirmation but UI unavailable`.

### 5.4 Tool/Path Policy Matrix

| Tool class | zero-access | read-only | no-delete |
|---|---|---|---|
| `read` / `find` / `ls` / `grep` | block | allow | allow |
| `write` / `edit` | block | block | allow |
| `bash` non-mutating | block if referencing protected path | allow | allow |
| `bash` mutating | block if referencing protected path | block | block when delete/move against protected path |

Mutating bash heuristics include (initial set):
- deletion/move: `rm`, `mv`, `rmdir`, `git clean`, cloud delete commands
- overwrite/edit patterns: redirection (`>`), `tee`, `sed -i`, etc.

### 5.5 Observability and Audit Trail

- Status key: `damage-control`
  - startup summary: active rule counts
  - short-lived violation summary: last blocked rule
- Session entry type: `damage-control-log`
  - fields: timestamp, tool_name, action, reason, rule_id, source_layer, input_preview
- Keep log payload concise and redact/truncate long command bodies.

### 5.6 Bundled Defaults Strategy

- Seed `default-rules.yaml` from the IndyDevDan rule set, then prune/normalize naming.
- Keep defaults broad enough to protect against catastrophic actions, but conservative enough to avoid daily false positives.
- Document local extension points clearly in README (global/project additive files).

## 6. Error Handling and Failure Modes

### `rules_file_not_found`
- Trigger: global/project file missing.
- Handling: continue with available layers; info-level startup note only.

### `rules_parse_error`
- Trigger: invalid YAML.
- Handling: skip invalid layer, notify warning, continue with remaining layers.

### `rule_validation_error`
- Trigger: malformed schema fields.
- Handling: skip invalid entries, keep valid entries, include count in warning.

### `regex_compile_error`
- Trigger: invalid regex pattern.
- Handling: drop that bash pattern rule, warn once with rule identifier.

### `ask_without_ui`
- Trigger: `ask` action in non-interactive/no-UI mode.
- Handling: block (fail closed).

### `policy_evaluation_error`
- Trigger: unexpected runtime exception during matching.
- Handling: block with internal safety reason and emit warning (fail closed).

## 7. Security and Safety Considerations

- Treat rule files as untrusted text input; parse defensively.
- Never execute shell from rule contents; matching is pure data evaluation.
- Normalize candidate paths before matching (`~` expansion, absolute resolution, slash normalization).
- Ensure violation messages to the model explicitly prohibit workaround attempts.
- Truncate/redact potentially sensitive command snippets in audit logs.

## 8. Testing Strategy

### 8.1 Unit Tests

Add focused unit tests for pure modules:
- rule parsing/normalization (valid + malformed YAML)
- layered merge and dedupe behavior
- path matching (`file`, `dir/`, glob `*`/`**`/`?`, `~` expansion)
- policy matrix behavior by tool + tier
- ask-mode fallback in no-UI context

### 8.2 Integration / Manual Validation

- Run `bun run check`.
- Launch Pi with this package and verify:
  - startup status shows merged rule counts
  - known destructive bash commands are blocked
  - ask rules prompt correctly and log decisions
  - `write/edit/read` obey path-tier matrix
  - global + project additive config behavior is correct
- Validate session contains `damage-control-log` custom entries after violations.

## 9. Implementation Checklist

- [x] Create `extensions/damage-control/` module skeleton (`index.ts`, `constants.ts`, `types.ts`, `rules-loader.ts`, `matcher.ts`, `policy.ts`).
- [x] Add bundled `damage-control-rules.yaml` (baseline curated from reference implementation).
- [x] Implement layered rule source resolution (bundled/global/project).
- [x] Implement rule normalization + validation + regex compilation.
- [x] Implement path matching helpers and bash mutation/delete heuristics.
- [x] Implement `tool_call` evaluator with deterministic first-violation enforcement.
- [x] Implement ask flow with no-UI fail-closed behavior.
- [x] Add session audit logging (`damage-control-log`) and status/notify feedback.
- [x] Add `extensions/damage-control/README.md` with config examples and troubleshooting.
- [ ] Add/adjust tests for parser/matcher/policy modules.
- [x] Update architecture/quality/exec-plan docs to reference this spec and extension.
- [x] Run `bun run check` and verify no regressions.

## 10. Resolved v1 Decisions

1. **Inheritance/overrides**
   - v1 remains additive-only (no disable/override semantics yet).

2. **Project rule discovery boundary**
   - Discover `.pi/damage-control-rules.yaml` by walking from `cwd` up to git root (or filesystem root when no git root exists).

3. **Global rule source**
   - Always include global rules from Pi agent directory (`getAgentDir()/damage-control-rules.yaml`) in addition to project discovery.

4. **Audit surface**
   - Session entries only in v1 (`damage-control-log`), no separate file log sink.

## 11. Deferred Enhancements

- Expert integration idea (deferred): allow expertise domains to declare protected paths/rules that can be merged into damage-control policy at runtime.
- Potential v2 policy ergonomics: rule disable/override mechanics, per-tool granularity, richer command parsing.
