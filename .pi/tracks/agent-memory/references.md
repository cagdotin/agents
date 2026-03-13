# References

## Primary Research Source
- Fireship video (2026-03-12): https://www.youtube.com/watch?v=Xn-gtHDsaPY
  - Survey source that surfaced QMD and OpenViking as the two most relevant memory/search systems to examine.

## QMD — Query Markup Documents
- **Repo:** https://github.com/tobi/qmd
- **Local fork:** `~/git/qmd-fork` (v2.0.1 + PR #377 + PR #385)
- **SDK package:** `@tobilu/qmd`
- **Primary docs:** `~/git/qmd-fork/README.md`
- **Key source files:**
  - `~/git/qmd-fork/src/index.ts` — SDK surface (`createStore`, store methods)
  - `~/git/qmd-fork/src/store.ts` — lower-level internals and store operations
  - `~/git/qmd-fork/src/collections.ts` — collection config helpers and collection-name validation
  - `~/git/qmd-fork/src/cli/qmd.ts` — CLI path/context behavior and operator UX
- **Important implementation references:**
  - PR #377 — https://github.com/tobi/qmd/pull/377
  - PR #385 — https://github.com/tobi/qmd/pull/385

## Pi Integration References
- `skills/qmd/SKILL.md` — agent-facing CLI usage guidance
- `docs/references/pi-api-reference.md` — repo-focused Pi extension API notes
- Pi upstream extension docs:
  - `/Users/cgn/.local/share/mise/installs/node/23.3.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- Pi examples checked for feasibility/patterns:
  - `/Users/cgn/.local/share/mise/installs/node/23.3.0/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/dynamic-tools.ts`
  - `/Users/cgn/.local/share/mise/installs/node/23.3.0/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/plan-mode/index.ts`

## Design Lenses Applied to the Extension Review
- `docs/resources/unix-philosophy-raymond.md`
  - Primary design lens for modularity, separation, representation, silence, and repair.
- `docs/resources/deep-modules-ai-ready-codebase.md`
  - Primary design lens for preferring deeper modules, smaller public surfaces, and progressive disclosure.

## OpenViking — Context Database for AI Agents
- **Repo:** https://github.com/volcengine/OpenViking
- **Website:** https://www.openviking.ai
- **Key docs read:**
  - `docs/en/concepts/01-architecture.md`
  - `docs/en/concepts/02-context-types.md`
  - `docs/en/concepts/03-context-layers.md`
  - `docs/en/concepts/05-storage.md`
  - `docs/en/concepts/06-extraction.md`
  - `docs/en/concepts/07-retrieval.md`
  - `docs/en/concepts/08-session.md`
  - `docs/en/concepts/06-mcp-integration.md`
- **Why it matters here:** useful for design ideas (tiering, hierarchical retrieval, memory promotion), not as a direct implementation target.

## Local Track Artifacts
- `specs/qmd-extension-v1.md` — current design spec
- `exec-plans/qmd-extension-v1.md` — rollout plan
- `findings.md` — durable discoveries and constraints
- `decisions.md` — design decisions and rationale
- `report.md` — current implementation status
