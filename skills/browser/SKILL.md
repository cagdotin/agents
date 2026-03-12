---
name: browser
description: Fetch and read web pages using Lightpanda headless browser. Renders JavaScript, extracts clean markdown, and respects robots.txt. Use when you need to read articles, documentation, or any web content.
---

# Browser

Fetch and read web pages with Lightpanda — a fast headless browser that executes
JavaScript and produces clean output.

## Setup

```bash
cd {baseDir} && bun install
```

This downloads the Lightpanda native binary to `~/.cache/lightpanda-node/lightpanda`.

## Usage

### Read a web page (default — use this most of the time)

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots '<url>'
```

### Output formats

| Format | Flag | When to use |
|--------|------|-------------|
| `markdown` | `--dump markdown` | Default. Clean, readable, LLM-friendly |
| `semantic_tree_text` | `--dump semantic_tree_text` | Huge pages — more compact than markdown |
| `html` | `--dump html` | Need raw HTML, meta tags, or structured data |
| `semantic_tree` | `--dump semantic_tree` | Structured accessibility tree |

### Strip modes

| Mode | Flag | Effect |
|------|------|--------|
| `full` | `--strip_mode full` | Remove JS, CSS, images, SVG (recommended default) |
| `js` | `--strip_mode js` | Remove only scripts |
| `css` | `--strip_mode css` | Remove only styles |
| `ui` | `--strip_mode ui` | Remove images, pictures, video, CSS, SVG |

### Timeout

For slow sites, increase the HTTP timeout (default 10s):

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots --http_timeout 15000 '<url>'
```

## Defaults

Always use these unless you have a specific reason not to:

- `LIGHTPANDA_DISABLE_TELEMETRY=true` — no telemetry
- `--obey_robots` — respect robots.txt (skip only for localhost)
- `--strip_mode full` — minimal output size
- `--dump markdown` — readable output

## Tips

- **Large output?** Pipe through `head -n 200` or switch to `semantic_tree_text`
- **JavaScript-heavy SPA?** Lightpanda executes JS before dumping — it just works
- **localhost URLs?** Drop `--obey_robots` for local development servers
- **GitHub pages?** Work but include navigation chrome — output is noisy
- **Page fails or crashes?** Lightpanda is beta — try a different dump format, or the site may use unsupported Web APIs

## Examples

Read an article:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots 'https://example.com/article'
```

Check API docs:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots 'https://docs.example.com/api'
```

Get compact summary of a large page:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump semantic_tree_text --strip_mode full --obey_robots 'https://example.com' \
  | head -n 100
```

Inspect meta tags and structured data:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump html --strip_mode js --obey_robots 'https://example.com' \
  | grep -i '<meta\|og:\|schema.org'
```
