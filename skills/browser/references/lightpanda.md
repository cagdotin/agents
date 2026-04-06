# Lightpanda — Read-Only Web Fetching

Fetch and read web pages with Lightpanda — a fast headless browser that executes
JavaScript and produces clean output. Use for reading articles, documentation,
and any web content where you don't need to interact with the page.

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

Removes tag groups from the output. Can be a single mode or comma-separated list.

| Mode | Flag | Effect |
|------|------|--------|
| `full` | `--strip_mode full` | Remove JS, CSS, images, SVG (recommended default) |
| `js` | `--strip_mode js` | Remove only scripts |
| `css` | `--strip_mode css` | Remove only styles |
| `ui` | `--strip_mode ui` | Remove images, pictures, video, CSS, SVG |

Combine modes: `--strip_mode js,css` removes scripts and styles but keeps images.

### Iframe content

Include iframe content in the output with `--with_frames`:

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots --with_frames '<url>'
```

### Base tag

Add a `<base>` tag to HTML output (useful when saving HTML locally):

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump html --strip_mode full --obey_robots --with_base '<url>'
```

### Timeouts

Two separate timeout controls:

| Flag | Default | Purpose |
|------|---------|---------|
| `--http_timeout` | 10000ms | Max time for the entire transfer to complete |
| `--http_connect_timeout` | 0 (none) | Max time to establish the HTTP connection |

For slow sites, increase the transfer timeout:

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots --http_timeout 15000 '<url>'
```

For sites slow to connect (DNS, TLS handshake):

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots --http_connect_timeout 10000 '<url>'
```

### Proxy

Route requests through an HTTP proxy:

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots \
  --http_proxy 'http://proxy.example.com:8080' '<url>'
```

For bearer token authentication with the proxy:

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots \
  --http_proxy 'http://proxy.example.com:8080' \
  --proxy_bearer_token '<token>' '<url>'
```

### Response size limits

Limit the maximum response size for any request (XHR, fetch, scripts, etc.):

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots \
  --http_max_response_size 5000000 '<url>'
```

### Connection tuning

| Flag | Default | Purpose |
|------|---------|---------|
| `--http_max_concurrent` | 10 | Max concurrent HTTP requests |
| `--http_max_host_open` | 4 | Max open connections per host:port |

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
- **Pages with iframes?** Add `--with_frames` to include iframe content
- **Page fails or crashes?** Lightpanda is beta — try a different dump format, or the site may use unsupported Web APIs. If the page still fails, use agent-browser as a Chrome-based fallback: `$ab open '<url>' && $ab get text body`

## Examples

Read an article:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots 'https://example.com/article'
```

Read a page with iframes:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots --with_frames 'https://example.com/embedded'
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

Fetch through a proxy with increased timeout:
```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots \
  --http_proxy 'http://proxy:8080' --http_timeout 20000 'https://example.com'
```
