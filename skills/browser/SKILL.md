---
name: browser
description: Fetch and read web pages using Lightpanda headless browser, or automate full browser interactions using agent-browser. Use when you need to read articles, documentation, any web content, or interact with web pages.
---

# Browser

Use this skill for fetching web content and automating browser interactions.

## Shared guidance

- Always prefer Lightpanda for **read-only** fetching — it's faster and lighter.
- Use agent-browser when you need to **interact** with a page (click, fill forms, navigate, screenshot).
- Always set `LIGHTPANDA_DISABLE_TELEMETRY=true` when using Lightpanda.
- Always pass `--obey_robots` to Lightpanda (skip only for localhost).
- **Fallback**: if Lightpanda fails or crashes on a page, use agent-browser (`$ab open '<url>' && $ab get text body`) as a Chrome-based fallback.

## Routing

| Task | Reference to read |
|------|-------------------|
| Read a web page, article, or docs | `references/lightpanda.md` |
| Interact with a page (click, fill, screenshot, test) | `references/agent-browser.md` |
| Authentication flows (login, OAuth, 2FA, state reuse) | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/authentication.md` |
| Multiple parallel sessions, state persistence | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/session-management.md` |
| Snapshot refs lifecycle, troubleshooting | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/snapshot-refs.md` |
| Video recording for debugging/docs | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/video-recording.md` |
| Performance profiling | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/profiling.md` |
| Proxy configuration | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/proxy-support.md` |

## Quick reference (read-only fetch)

For the most common case — just reading a page — use this directly:

```bash
LIGHTPANDA_DISABLE_TELEMETRY=true ~/.cache/lightpanda-node/lightpanda fetch \
  --dump markdown --strip_mode full --obey_robots '<url>'
```

For everything else, load the appropriate reference file.
