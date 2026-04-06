# Browser

Fetch, read, and interact with web pages using two complementary tools:

- **[Lightpanda](https://lightpanda.io)** — fast headless browser for read-only
  fetching. Executes JavaScript, produces clean markdown, 11x faster than Chrome
  headless with 9x less memory.
- **[agent-browser](https://agent-browser.dev)** — browser automation CLI for AI
  agents. Full interaction: click, type, screenshot, navigate. Ref-based element
  selection with compact accessibility tree output.

## When to use which

| Task | Tool |
|------|------|
| Read an article, docs, or blog post | Lightpanda |
| Fetch API docs or web content | Lightpanda |
| Fill a form, click buttons, navigate | agent-browser |
| Take screenshots for visual testing | agent-browser |
| Test UI interactions or responsive layout | agent-browser |
| Lightpanda fails on a page | agent-browser (fallback) |

## Setup

```bash
cd skills/browser && bun install
```

This installs:
- `@lightpanda/browser` — downloads the Lightpanda native binary to `~/.cache/lightpanda-node/lightpanda`
- `agent-browser` — native Rust CLI for browser automation (run `npx agent-browser install` on first use to download Chrome)

## Skill structure

```
skills/browser/
├── SKILL.md                        ← main skill (routing + quick reference)
├── references/
│   ├── lightpanda.md               ← read-only fetching (formats, modes, tips)
│   └── agent-browser.md            ← interactive automation (commands, sessions, examples)
├── package.json                    ← dependencies
└── README.md                       ← this file
```

## See also

- [Lightpanda docs](https://docs.lightpanda.io)
- [agent-browser docs](https://agent-browser.dev)
- [Spec](../../docs/specs/lightpanda-browser-integration.md) — original design rationale
