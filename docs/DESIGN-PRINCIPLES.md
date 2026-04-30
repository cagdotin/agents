# DESIGN PRINCIPLES

Status: active
Last updated: 2026-04-30

These principles guide how we design extensions, skills, and tools in this
repository. They are distilled from external research and validated through
building. For the full analyses, see the vault (`0xcgn/vault`).

---

## 1. Fewer tools, better judgment

Four core tools (read, write, edit, bash) are enough. Bash is a universal
gateway to the entire CLI ecosystem. Every additional tool definition eats
context budget and pushes the model toward diminishing returns.

**In practice:**
- Don't add a dedicated tool when a skill + bash achieves the same thing
- Skills layer domain knowledge without polluting the tool namespace
- Context performance degrades past ~40% usage (the "dumb zone")

**Source:** Dex, "Context Engineering for Coding Agents" — dumb zone concept,
context budget management. Rob Pike: "Data dominates" — fold knowledge into
data (markdown skills), keep program logic (tool definitions) minimal.

---

## 2. Deep modules over shallow helpers

Prefer fewer, larger modules with simple interfaces over many small modules
with many exports. The interface explains what it does; the implementation is
internal. This makes the codebase navigable for both humans and agents.

AI is a perpetual new starter with no memory. It doesn't carry a mental map
of the codebase — it sees a flat collection of modules that can all import
from each other. Your codebase structure, way more than your prompt or
AGENTS.md, is the biggest influence on AI's output.

**What a deep module looks like:**
- Lots of implementation behind a simple, well-defined interface
- All exports go through the interface — no reaching into internals
- The interface explains WHAT the module does without revealing HOW
- Tests lock down behavior at the interface boundary

**Graybox modules:** you don't need to look inside a module as long as tests
pass. AI manages implementation; humans apply taste at the boundaries —
interface design, what belongs where, how modules compose. This is still a
million miles from vibe coding. The skill is in designing the seams.

**In practice:**
- Extensions follow one structure: `index.ts`, types, helpers, storage, tool
- Public API is the tool parameters + slash commands
- Internal logic stays internal — don't export helpers between extensions
- Invariant: no cross-extension runtime dependencies
- When adding code, ask: does this belong inside an existing module, or does
  it justify a new module with its own interface?
- Avoid many small shallow modules — they're hard to navigate and harder to
  test meaningfully

**Source:** John Ousterhout, *A Philosophy of Software Design* — deep modules.
Matt Pocock, "Your Codebase Is Probably Not Ready for AI" — codebase structure
matters more than prompts.

---

## 3. Structure enables discovery

Agents orient through structured environments, not frontloaded instructions.
AGENTS.md is a door, not a room. Progressive disclosure through the file tree
replaces monolithic documentation.

**In practice:**
- AGENTS.md stays short (~100 lines) — a map, not an encyclopedia
- Entry surfaces stay narrow: `README.md` → `AGENTS.md` → `docs/ARCHITECTURE.md` → focused docs/READMEs → source
- Every extension has a README discoverable without reading source first
- Name things clearly; the code is the real documentation for implementation

**Source:** matklad, "ARCHITECTURE.md" — externalize the mental map, name
things don't link them, call out invariants and boundaries. OpenAI,
"Harness Engineering" — progressive disclosure, agent legibility.

---

## 4. Mechanical enforcement over convention memory

If a rule matters, encode it in `bun run check`. Agents replicate existing
patterns including bad ones — the codebase is the real prompt. Behavioral
guidelines are suggestions; structural constraints are guarantees.

**In practice:**
- `bun run check:biome` — formatting and lint
- `bun run check:docs` — documentation structure and forbidden legacy surfaces
- `bun run check:boundaries` — cross-extension import rules
- Agent-legible error messages: say what's wrong, why, and how to fix
- Prefer structural enforcement over narrative scorecards or freshness theater
- Prefer Zod at runtime boundaries, TypeBox at Pi tool boundaries

**Source:** OpenAI, "Harness Engineering" — enforce boundaries centrally,
allow autonomy locally. Linter errors include remediation instructions
injected into agent context. Eric Raymond, "Rule of Repair" — when you must
fail, fail noisily and as soon as possible.

---

## 5. The Unix rules

We follow the Unix philosophy as our foundation for designing agent tools.
These 17 rules from Eric Raymond's *The Art of Unix Programming* apply
directly to how we build extensions, skills, and workflows.

**The rules we obey:**

1. **Modularity** — write simple parts connected by clean interfaces
2. **Clarity** — clarity is better than cleverness
3. **Composition** — design programs to be connected to other programs
4. **Separation** — separate policy from mechanism; interfaces from engines
5. **Simplicity** — design for simplicity; add complexity only where you must
6. **Parsimony** — write a big program only when nothing else will do
7. **Transparency** — design for visibility to make inspection and debugging easier
8. **Robustness** — robustness is the child of transparency and simplicity
9. **Representation** — fold knowledge into data so program logic can be stupid and robust
10. **Least Surprise** — in interface design, always do the least surprising thing
11. **Silence** — when a program has nothing surprising to say, it should say nothing
12. **Repair** — when you must fail, fail noisily and as soon as possible
13. **Economy** — programmer time is expensive; conserve it in preference to machine time
14. **Generation** — avoid hand-hacking; write programs to write programs when you can
15. **Optimization** — prototype before polishing. Get it working before you optimize it
16. **Diversity** — distrust all claims for "one true way"
17. **Extensibility** — design for the future

**How these map to our work:**

| Rule | How we apply it |
|---|---|
| Modularity | Extensions are isolated, composable units with clean interfaces |
| Composition | Text is the universal interface — bash composes CLI tools, skills are markdown data |
| Separation | Extensions = mechanism, skills = policy. Tool params = interface, internals = engine |
| Simplicity | 4 core tools, ~200 token system prompt, progressive disclosure |
| Parsimony | Don't build when a skill + bash achieves the same thing |
| Representation | Skills as markdown, agents as `.md` files with frontmatter, rules in YAML |
| Silence | Footers and panels show info only when useful, stay quiet otherwise |
| Repair | Agent-legible error messages: what's wrong, why it matters, how to fix |
| Economy | Agent time is cheap; human time is expensive. Automate the tedious parts |
| Generation | Meta-agents that build agents, meta-skills that create skills |
| Optimization | Build proof of concepts quickly, evaluate by feel, cut what doesn't work |

**In practice:**
- CLI tools composed through bash > dedicated integrations
- Skills as static markdown playbooks, not runtime code
- Extensions are small, single-purpose, composable via stacking (`pi -e a.ts -e b.ts`)
- No build step — Pi loads TypeScript directly
- When in doubt, use brute force (Ken Thompson)

**Source:** Eric Raymond, *The Art of Unix Programming* (2003). Doug McIlroy:
"Write programs that do one thing and do it well. Write programs to work together.
Write programs to handle text streams, because that is a universal interface."

---

## 6. Prototype before polishing

When execution is cheap, building is a form of thinking. Try things, evaluate
by feel, cut ruthlessly. The graveyard is proof of active curation.

**In practice:**
- Build proof-of-concept extensions quickly; don't over-plan
- Evaluate through use, not through design documents
- Move failed experiments to `.graveyard/` with a note on why
- Removing code is as valuable as writing it

**Source:** Eric Raymond, "Rule of Optimization" — get it working before you
optimize it. "Rule of Parsimony" — write a big program only when clear by
demonstration that nothing else will do.

---

## 7. Code is the source of truth

The code is what runs. Documentation points fingers at the code — it orients,
it doesn't describe everything. Documentation lies more than code;
auto-generated comments lie most of all.

**In practice:**
- Expertise files (`.pi/expertise/`) are working memory, not source of truth
- Backlog and follow-up work live in GitHub issues; complex design/execution context may live in specs or exec plans
- When docs and code disagree, the code wins
- Keep docs thin enough to maintain, accurate enough to trust

**Source:** IndyDevDan, "Agent Experts" — expertise is working memory, not
source of truth. Dex, "Context Engineering" — documentation has the most lies,
actual code has the fewest.

---

## Quick reference

| Principle | One-liner | Enforcement |
|---|---|---|
| Fewer tools | Bash + skills > dedicated tools | Skill design review |
| Deep modules | Simple interfaces, graybox internals, taste at the seams | `check:boundaries` |
| Structure enables discovery | Progressive disclosure through file tree | `check:docs` |
| Mechanical enforcement | Encode rules in tooling | `bun run check` |
| Unix rules | 17 rules — modularity, composition, silence, repair, representation | Extension patterns |
| Prototype first | Build → evaluate → cut | `.graveyard/` |
| Code is truth | Docs orient, code defines | Invariant 6 in ARCHITECTURE |
