# Agent Browser vs Lightpanda: Deep Comparison Report

**Date:** 2026-04-05  
**Purpose:** Evaluate whether Vercel's agent-browser should replace or complement Lightpanda as the primary browser tool for AI agent workflows.

---

## Executive Summary

**Lightpanda** and **agent-browser** are fundamentally different tools solving different problems, despite both being aimed at AI agents and automation. They are not direct competitors — they are **complementary**, and agent-browser even supports Lightpanda as a backend engine (`--engine lightpanda`).

| | Lightpanda | agent-browser |
|---|---|---|
| **What it is** | A from-scratch headless browser engine (Zig) | A browser automation CLI wrapping Chrome via CDP (Rust) |
| **Primary use case** | Fast page fetching, content extraction | Full browser automation, interaction, testing |
| **Interaction model** | Fetch-and-dump (one-shot) | Stateful session with click/fill/navigate |
| **Browser engine** | Custom (Zig, no Chromium) | Chrome/Chromium (via CDP), Lightpanda optional |
| **Stars** | ~27.2k | ~27.2k |
| **License** | AGPL-3.0 | Apache-2.0 |
| **Binary size** | ~59 MB | ~15 MB CLI + Chrome (~300+ MB) |

**Bottom line:** Lightpanda is the right tool for what you're doing now (reading web pages). Agent-browser would be the right tool if you need to *interact* with web pages (click buttons, fill forms, navigate multi-step flows). They solve different problems.

---

## 1. Architecture & How They Work

### Lightpanda

Lightpanda is a **ground-up browser engine** written in Zig. It's not a wrapper around Chrome or Chromium — it implements its own HTML parser, CSS engine, DOM, and JavaScript runtime. Critically, it **does not render pixels** — there's no visual output, no GPU, no compositor.

**How it works for your current use case:**
```
Agent calls CLI → Lightpanda binary fetches URL → Executes JavaScript →
Builds DOM → Converts to markdown/semantic tree → Returns text to stdout
```

It operates in three modes:
1. **`fetch`** — One-shot: fetch a URL, dump content, exit. This is what you use.
2. **`serve`** — CDP WebSocket server (Puppeteer/Playwright compatible).
3. **`mcp`** — Model Context Protocol server for LLM tool calling.

**Key architectural traits:**
- No Chromium dependency — the binary IS the browser
- ~59 MB single binary, ~24 MB peak memory per page
- JavaScript execution via embedded engine
- No rendering pipeline = no screenshots, no visual testing
- CDP-compatible protocol for programmatic control

### agent-browser

Agent-browser is a **Rust CLI that controls Chrome** through the Chrome DevTools Protocol (CDP). It doesn't implement a browser — it orchestrates one.

**How it works:**
```
Agent calls CLI → Rust CLI sends CDP command → Background daemon manages
Chrome instance → Chrome renders page → Daemon returns result → CLI outputs
```

It uses a **client-daemon architecture:**
1. **Rust CLI** — Fast native binary that parses commands
2. **Rust Daemon** — Background process managing Chrome via CDP (no Node.js required)
3. **Chrome** — The actual browser engine (downloaded from Chrome for Testing)

**Key architectural traits:**
- Full Chrome rendering engine (every web API works)
- Daemon persists between commands (fast subsequent calls)
- Accessibility tree snapshots with ref-based element targeting
- Screenshots, PDFs, visual diffs
- Session isolation, auth state management
- Cloud provider integrations (Browserbase, Browserless, AWS AgentCore, etc.)

---

## 2. Feature Comparison

### Content Extraction (Your Primary Use Case)

| Feature | Lightpanda | agent-browser |
|---------|-----------|---------------|
| Fetch page as markdown | ✓ `--dump markdown` | ✗ No direct equivalent |
| Fetch page as HTML | ✓ `--dump html` | ✓ `get html` (requires open + get) |
| Semantic tree | ✓ `--dump semantic_tree` | ✓ `snapshot` (accessibility tree) |
| Strip JS/CSS/images | ✓ `--strip_mode full` | ✗ Not applicable |
| robots.txt respect | ✓ `--obey_robots` | ✗ No built-in |
| One-shot operation | ✓ Single command, exits | ✗ Requires open → get → close |
| JavaScript execution | ✓ (built-in engine) | ✓ (Chrome's V8) |
| iframe content | ✓ `--with_frames` | ✓ `frame` command |
| Speed (simple page) | ~0.2s | ~2-5s (Chrome startup overhead) |
| Memory per page | ~24 MB | ~200+ MB (Chrome) |

**Verdict for content extraction:** Lightpanda wins decisively. It's 10x faster, uses 9x less memory, and its one-shot `fetch` command is perfectly suited for "read this web page" workflows. agent-browser requires managing a Chrome session, which is massive overkill for content reading.

### Browser Automation & Interaction

| Feature | Lightpanda | agent-browser |
|---------|-----------|---------------|
| Click elements | ✗ | ✓ CSS/ref/semantic selectors |
| Fill forms | ✗ | ✓ Type, fill, select |
| Navigate multi-step flows | ✗ | ✓ Full navigation control |
| Screenshots | ✗ | ✓ PNG/JPEG, full page, annotated |
| PDFs | ✗ | ✓ Full PDF generation |
| Visual diffs | ✗ | ✓ Pixel-level screenshot diffs |
| Snapshot diffs | ✗ | ✓ Accessibility tree diffs |
| Keyboard/mouse control | ✗ | ✓ Full input simulation |
| File uploads | ✗ | ✓ Upload command |
| Drag and drop | ✗ | ✓ Drag command |
| Wait for conditions | ✗ | ✓ Text, URL, selector, JS condition |
| Network interception | ✗ | ✓ Route, mock, block, HAR recording |
| Cookie management | ✗ | ✓ Get/set/clear |
| localStorage/sessionStorage | ✗ | ✓ Full CRUD |
| Tab/window management | ✗ | ✓ Multi-tab, multi-window |
| Dialog handling | ✗ | ✓ Accept/dismiss/auto-handle |
| Device emulation | ✗ | ✓ Viewport, device profiles |
| Geolocation emulation | ✗ | ✓ Set coordinates |
| Color scheme emulation | ✗ | ✓ Dark/light mode |
| Proxy support | ✓ `--http_proxy` | ✓ `--proxy` |
| Batch execution | ✗ | ✓ JSON-piped batch commands |

**Verdict for automation:** agent-browser is in a completely different league. Lightpanda has zero interaction capabilities — it's read-only. If you need to test login flows, fill forms, click through UIs, or do visual regression testing, agent-browser is the only option.

### AI Agent Integration

| Feature | Lightpanda | agent-browser |
|---------|-----------|---------------|
| JSON output for agents | ✗ | ✓ `--json` flag |
| Ref-based element targeting | ✗ | ✓ `@e1, @e2` from snapshots |
| Content boundary markers | ✗ | ✓ `--content-boundaries` |
| Output length limits | ✗ | ✓ `--max-output` |
| Domain allowlists | ✗ | ✓ `--allowed-domains` |
| Action policies | ✗ | ✓ `--action-policy` |
| Auth vault (hide passwords from LLM) | ✗ | ✓ Encrypted credential store |
| MCP server | ✓ Built-in `mcp` mode | ✗ |
| Claude Code skill | ✗ | ✓ Official skill (`npx skills add`) |
| Session isolation | ✗ (stateless) | ✓ Named sessions |
| Observability dashboard | ✗ | ✓ Live viewport + activity feed |
| Annotated screenshots | ✗ | ✓ Numbered element labels |

**Verdict for AI integration:** agent-browser has far more agent-specific features, but most are relevant only for interactive automation. For read-only page fetching (your use case), Lightpanda's simplicity is an advantage — less can go wrong.

### Security & Safety

| Feature | Lightpanda | agent-browser |
|---------|-----------|---------------|
| License | AGPL-3.0 (copyleft) | Apache-2.0 (permissive) |
| Telemetry | Opt-out via env var | None mentioned |
| robots.txt | ✓ Built-in | ✗ |
| Domain restrictions | ✗ | ✓ `--allowed-domains` |
| Action gating | N/A (read-only) | ✓ Policy files + confirmation |
| Session encryption | N/A | ✓ AES-256-GCM |
| Content boundaries | ✗ | ✓ LLM injection protection |

### Deployment & Operations

| Feature | Lightpanda | agent-browser |
|---------|-----------|---------------|
| Single binary | ✓ 59 MB | ~15 MB CLI + Chrome |
| Total disk footprint | ~59 MB | ~350+ MB (CLI + Chrome) |
| Memory per page | ~24 MB | ~200+ MB |
| Startup time | <0.1s | 2-5s (Chrome launch) |
| Cloud browser providers | ✓ Cloud API available | ✓ 5+ providers (Browserbase, etc.) |
| Docker support | ✓ | ✓ |
| Serverless friendly | ✓ (very) | ✓ (with @sparticuz/chromium or Vercel Sandbox) |
| Platforms | macOS, Linux (ARM64/x64) | macOS, Linux, Windows (all arch) |
| Windows support | ✗ | ✓ |
| iOS Simulator | ✗ | ✓ Mobile Safari testing |

---

## 3. Compatibility & Interoperability

A fascinating detail: **agent-browser supports Lightpanda as a backend engine**.

```bash
agent-browser --engine lightpanda open https://example.com
```

This means agent-browser can use Lightpanda instead of Chrome for pages where full rendering isn't needed, while falling back to Chrome for pages that require it. This makes them explicitly complementary, not competing.

Additionally, Lightpanda's `serve` mode exposes a CDP-compatible WebSocket server, meaning Puppeteer, Playwright, and any CDP client (including agent-browser) can connect to it.

---

## 4. Web Compatibility & Reliability

### Lightpanda

- **Beta status** — The engine is under active development
- Some Web APIs are unsupported (e.g., `adoptedStyleSheets` causes errors on GitHub)
- JavaScript execution works for most sites, but complex SPAs may fail
- Your SKILL.md notes: "Lightpanda is beta — try a different dump format, or the site may use unsupported Web APIs"
- No visual rendering means some JS that depends on layout/paint won't execute correctly
- Works excellently for: articles, documentation, static sites, server-rendered pages

### agent-browser

- **Chrome backing** — Every web API works because it IS Chrome
- Production-grade rendering engine
- Full SPA support (React, Vue, Angular, etc.)
- All modern CSS, Web Components, Shadow DOM
- Pixel-perfect screenshots
- Trade-off: carries Chrome's 200+ MB memory overhead

---

## 5. Cost/Benefit Analysis for Your Setup

### Current State: Lightpanda

You use Lightpanda for a single purpose: **reading web pages and extracting content as markdown**. This is Lightpanda's sweet spot.

**Benefits you get today:**
- ~0.2s page fetch (extremely fast)
- Clean markdown output with strip modes
- ~24 MB memory per operation
- Simple one-liner commands
- robots.txt compliance built-in
- No Chrome dependency

**Pain points:**
- Beta software — some pages fail (GitHub JS errors, as seen during this investigation)
- No interaction capability
- No screenshots
- AGPL-3.0 license (relevant if you distribute)

### What agent-browser would add

**New capabilities you'd gain:**
- Click, fill, navigate — full browser automation
- Screenshots and visual testing
- Annotated screenshots for multimodal AI
- Session persistence and auth management
- Network interception and HAR recording
- Multi-tab workflows
- Cloud provider integrations
- JSON output optimized for agent consumption
- Snapshot-ref workflow (accessibility tree → `@e1` refs)

**What you'd lose if you replaced Lightpanda:**
- Speed (10x slower for simple fetches)
- Memory efficiency (9x more memory)
- Simplicity (one command vs. session management)
- robots.txt respect
- The elegant `--dump markdown --strip_mode full` pipeline

### What agent-browser would NOT replace

agent-browser has no equivalent to:
```bash
lightpanda fetch --dump markdown --strip_mode full --obey_robots '<url>'
```

To get similar output with agent-browser, you'd need:
```bash
agent-browser open '<url>'
agent-browser snapshot -i --json
# or
agent-browser eval "document.body.innerText"
agent-browser close
```

This gives you raw text or an accessibility tree, but NOT clean markdown with link preservation, heading structure, and list formatting. Lightpanda's markdown output is purpose-built for LLM consumption. agent-browser doesn't have this feature.

---

## 6. Recommendation

### Keep Lightpanda as your primary browser for content reading

Lightpanda is the right tool for your current workflow. It's faster, lighter, simpler, and produces better markdown output than anything agent-browser can do.

### Add agent-browser only when you need interaction

Consider installing agent-browser when you have use cases like:
- Testing web UIs (login flows, form submissions)
- Taking screenshots of pages
- Automating multi-step web workflows
- Visual regression testing
- Scraping sites that require authentication/interaction
- Working with pages that need full Chrome compatibility

### Suggested setup if you adopt both

```
Content reading (default)    → Lightpanda (fast, lightweight, markdown)
Interactive automation       → agent-browser (full Chrome, click/fill/navigate)
Complex/broken pages         → agent-browser as fallback
```

You could even create a wrapper skill that tries Lightpanda first and falls back to agent-browser if the page fails.

### Do NOT replace Lightpanda with agent-browser

The cost of replacement would be:
- **10x slower** page reads
- **9x more memory** per operation
- **Loss of markdown output** — agent-browser cannot produce equivalent content
- **Added complexity** — managing Chrome sessions for what should be a one-shot fetch
- **No robots.txt** compliance

The only scenario where replacement makes sense is if Lightpanda's web compatibility issues become a blocking problem (i.e., most pages you need to read fail). That doesn't appear to be the case.

---

## 7. Summary Matrix

| Criterion | Winner | Notes |
|-----------|--------|-------|
| Page content extraction | **Lightpanda** | Purpose-built, 10x faster |
| Markdown quality | **Lightpanda** | agent-browser has no markdown output |
| Browser automation | **agent-browser** | Lightpanda has zero interaction capability |
| Web compatibility | **agent-browser** | Full Chrome engine vs. beta Zig engine |
| Memory efficiency | **Lightpanda** | 24 MB vs. 200+ MB |
| Speed (simple fetch) | **Lightpanda** | 0.2s vs. 2-5s |
| AI agent safety features | **agent-browser** | Domain allowlists, action policies, etc. |
| Deployment simplicity | **Lightpanda** | Single 59 MB binary, no deps |
| Screenshot/visual | **agent-browser** | Lightpanda cannot render visually |
| Session/auth management | **agent-browser** | Profiles, sessions, encrypted vault |
| Cloud provider support | **agent-browser** | 5+ cloud browser integrations |
| License flexibility | **agent-browser** | Apache-2.0 vs. AGPL-3.0 |
| Your current use case | **Lightpanda** | Reading pages as markdown for AI context |

**Final verdict:** Keep Lightpanda. Add agent-browser to your toolbox when an interactive browser automation need arises — they're complementary tools, not competitors.
