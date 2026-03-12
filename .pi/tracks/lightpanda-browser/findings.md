# Findings

## Lightpanda CLI is surprisingly complete (2026-03-12)

The `fetch` command alone covers most agent browsing needs:
- `--dump markdown` produces clean LLM-friendly output
- `--dump semantic_tree_text` gives compact accessibility-tree format
- `--strip_mode full` removes JS/CSS/images — massive noise reduction
- JS execution happens before dump — SPAs and dynamic content work
- `--obey_robots` for ethical crawling

## MCP server exposes 7 tools natively (2026-03-12)

`lightpanda mcp` (stdio) provides: `goto`, `markdown`, `links`, `evaluate`,
`semantic_tree`, `interactiveElements`, `structuredData`. Stateful — navigate
once, extract many things. Not useful now (no MCP client), but a strong future
integration point.

## npm package exists (2026-03-12)

`@lightpanda/browser` v1.2.0 — auto-downloads platform binary and provides
programmatic spawn API. Could simplify setup if we go extension route later.

## GitHub pages are noisy (2026-03-12)

Fetching GitHub repos via markdown dump includes heavy navigation chrome
(sidebar, menus, footer). `semantic_tree_text` is cleaner for GitHub.
For README content specifically, the raw URL is better.

## Output can be large (2026-03-12)

Full page markdown can be thousands of lines. Mitigations:
- `--strip_mode full` (always use)
- `semantic_tree_text` for compact view
- Agent can pipe through `head -n` or use `--http_max_response_size`

## npm package binary path is not node_modules (2026-03-12)

`@lightpanda/browser` npm installs a Node.js CLI wrapper at
`node_modules/.bin/lightpanda` (for `upgrade` commands only). The actual native
binary is downloaded by postinstall to `~/.cache/lightpanda-node/lightpanda`.
The skill must reference the cache path, not the node_modules bin.

Also: bun blocks postinstall by default — first install requires
`bun pm trust @lightpanda/browser` to run the binary download.

## Sanity test results (2026-03-12)

Six scenarios tested, all passing:
1. **Wikipedia article** — 655 lines, clean markdown with nav chrome at top
2. **Anthropic docs (JS SPA)** — 268 lines, full JS-rendered content captured
3. **Hacker News semantic_tree_text** — 512 lines, compact structured format
4. **GitHub HTML meta extraction** — metadata/OG tags extractable via grep
5. **Bad URL** — clear error: `CouldntResolveHost`, outputs `# Navigation failed`
6. **Timeout** — 3s timeout on 10s delay → `OperationTimedout`, clean failure

Error messages include scope and level — agent-legible without extra parsing.
Lightpanda logs go to stderr with `$time`/`$scope`/`$level` prefix, easy to
filter with `grep -v '^\$time'`.
