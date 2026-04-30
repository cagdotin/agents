# Lightpanda Browser Integration

Status: **implemented — skill shipped**
Created: 2026-03-12
Track: `lightpanda-browser`

---

## What is Lightpanda?

A headless browser built from scratch in Zig, purpose-built for machines (not
humans). No graphical rendering — just DOM, JS execution, and Web APIs.

**Key stats:** 11x faster than Chrome headless, 9x less memory, instant startup.

**Maturity:** Beta. Many websites work. Web API coverage is incomplete but
improving steadily. Active development.

---

## Decision: skill-first, not extension

**Chosen approach:** Build a `browser` skill that teaches agents to use the
Lightpanda CLI via bash. Same pattern as the `youtube-transcript` skill.

**Why skill, not extension:**
- The agent already has `bash` — Lightpanda's CLI is one command away
- `lightpanda fetch --dump markdown` is a clean, single-shot CLI call
- An extension adds process management, tool registration, TUI rendering —
  none of which are needed to get value
- The `youtube-transcript` skill proves this pattern works well
- We should learn how to use it first, build patterns around real usage, and
  only then consider whether an extension adds enough over "agent runs bash"

**What the skill gives us:**
- Agent knows the tool exists and how to invoke it
- Best practices for output formats, stripping, research workflows
- Guidance on when to use markdown vs semantic tree
- Setup instructions for the binary

---

## Capabilities Verified (hands-on)

### CLI: `lightpanda fetch`

The primary integration surface. One command, clean output, no server needed.

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots '<url>'
```

**Dump formats:**
- `markdown` — best for general reading/research (LLM-friendly)
- `semantic_tree_text` — compact accessibility tree (good when pages are huge)
- `html` — full rendered HTML (post-JS execution)
- `semantic_tree` — structured accessibility tree

**Strip modes** (via `--strip_mode`):
- `full` — remove JS, CSS, images, SVG (recommended default)
- `js` — remove only scripts
- `css` — remove only styles
- `ui` — remove images, pictures, video, CSS, SVG

**Tested results:**
- Wikipedia → clean markdown with TOC, works well
- lightpanda.io → full JS-rendered content captured
- Hacker News → readable table layout, links preserved
- Anthropic docs → full sidebar + content, JS-rendered sections
- httpbin.org/html → clean prose, perfect extraction
- GitHub repos → works but includes navigation chrome (noisy)

### Other modes (documented for future reference)

**`lightpanda mcp`** — built-in MCP server over stdio. Exposes 7 tools:
`goto`, `markdown`, `links`, `evaluate`, `semantic_tree`,
`interactiveElements`, `structuredData`. Plus 2 resources. Stateful — can
navigate once and run multiple extractions. Not usable yet (we have no MCP
client support in our agent setup).

**`lightpanda serve`** — CDP server for Playwright/Puppeteer/Stagehand.
Full browser automation. Relevant for future extension work.

**`@lightpanda/browser`** (npm v1.2.0) — auto-downloads the binary, provides
programmatic spawn/manage API. Could simplify setup.

---

## When to graduate to an extension

An extension becomes worth the effort when any of these are true:

| Signal | Why it matters |
|--------|---------------|
| We add MCP client support to the agent harness | Can bridge to lightpanda's MCP server for stateful browsing |
| Agents frequently need multi-step browsing | Navigate → extract links → follow → extract (stateful session) |
| We want the browser always available without loading a skill | Extension tools are always registered; skills need explicit load |
| We need TUI rendering of fetched content | Extensions can render tool results with custom formatters |
| Frontend testing workflows emerge | CDP server mode needs process lifecycle management |
| We adopt Stagehand for AI browser automation | Needs CDP + process orchestration, too complex for bash |

**Until then:** the skill + bash approach covers web research, article reading,
documentation browsing, site checking, link extraction, and metadata scraping.

---

## Technical Notes

### Binary management
- macOS arm64: download from nightly releases or use `@lightpanda/browser` npm
- The setup script in the skill handles detection and download
- Binary location: wherever the user puts it, skill documents the path

### Output sizing
- Web pages can be large. `--strip_mode full` is the best first defense.
- `semantic_tree_text` is more compact than markdown for huge pages.
- The agent can pipe through `head -n` for very large outputs.

### Defaults
- Always `LIGHTPANDA_DISABLE_TELEMETRY=true`
- Always `--obey_robots` (ethical default, skip for localhost)
- Always `--strip_mode full` unless the agent needs styles/images
- `--http_timeout 15000` for slow sites (default is 10s)

### Known limitations
- Beta software — some sites will fail or crash
- Web API coverage is incomplete (growing steadily)
- No graphical rendering — can't screenshot or verify visual layout
- GitHub pages include lots of navigation chrome in markdown output

---

## Use Cases Unlocked (skill phase)

| Use Case | How |
|----------|-----|
| Read an article/blog post | `fetch --dump markdown` |
| Research a topic | Fetch page → extract links → follow interesting ones |
| Read API documentation | `fetch --dump markdown` on docs URLs |
| Check a deployed site | `fetch --dump markdown` on the URL |
| Analyze page metadata | `fetch --dump html` + grep for meta/og tags |
| Navigate JS-heavy SPAs | Lightpanda executes JS before dumping |
| Get compact page summary | `fetch --dump semantic_tree_text` |
| Verify content after deploy | `fetch` localhost URLs (skip `--obey_robots`) |

---

## Future scenarios (not now)

### Extension with MCP bridge
When we have MCP client support, spawn `lightpanda mcp` as a subprocess and
talk JSON-RPC over stdio. Enables stateful sessions: navigate once, then call
`links`, `evaluate`, `interactiveElements`, `structuredData` against the same
loaded page.

### CDP server for testing
Run `lightpanda serve`, connect with Puppeteer/Playwright from the agent's
test scripts. Enables: run the test suite in a real browser, take accessibility
snapshots, verify the agent's own frontend work.

### Stagehand for natural-language automation
Use Stagehand + Lightpanda CDP for "click the sign-up button" style commands.
Enables: interact with arbitrary UIs using natural language instead of
selectors. Depends on external LLM calls (Stagehand uses its own AI model).
