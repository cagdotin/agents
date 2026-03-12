# Browser

Fetch and read web pages using [Lightpanda](https://lightpanda.io), a headless
browser built in Zig. Executes JavaScript, produces clean markdown, and runs
11x faster than Chrome headless with 9x less memory.

## What this skill does

Teaches the agent to use the Lightpanda CLI via bash for web research tasks:

- Read articles, blog posts, and documentation
- Fetch JavaScript-rendered single-page applications
- Extract page metadata and structured data
- Check deployed sites and verify content

## Setup

```bash
cd skills/browser && bun install
```

The `@lightpanda/browser` npm package automatically downloads the native binary
for your platform (macOS arm64/x86_64, Linux arm64/x86_64).

## How it works

This is a **skill, not an extension**. It provides instructions that teach the
agent how to use `lightpanda fetch` via the bash tool. No custom tools, no
process management, no TUI rendering — just a CLI command the agent runs when
it needs to read a web page.

## Lightpanda maturity

Beta. Most websites work. Web API coverage is incomplete but improving. Some
sites may fail or produce unexpected output.

## See also

- [Spec](../../docs/specs/lightpanda-browser-integration.md) — full design
  rationale, future extension scenarios, and graduation criteria
- [Lightpanda GitHub](https://github.com/lightpanda-io/browser)
- [Lightpanda docs](https://docs.lightpanda.io)
