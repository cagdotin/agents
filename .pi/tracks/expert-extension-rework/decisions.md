# Decisions

## 1. Kill reflection entirely (not lighten it)

The reflection pipeline's problem isn't performance — it's that LLM-driven full-file rewrites produce low-signal updates that corrupt the long-lived mental model. Transient conversation details get baked into expertise files. The circular inject→reflect→inject cycle rarely produces meaningful changes.

**Replacement**: a surgical `append` tool action where the agent adds one insight at a time, without rewriting existing content.

## 2. Replace auto-injection with skills-like awareness

Auto-injection via heuristic keyword/alias/path matching adds 1000-3000+ tokens per turn with unreliable accuracy. False positives waste context; false negatives miss relevant domains.

**Replacement**: compact domain listing in system prompt (~10-20 tokens per domain). Agent reads full YAML on demand via `expertise get`. Zero speculative cost.

## 3. Keep pinned injection

Pinning is user-explicit — the context cost is intentional and controlled. The `/expert chat` UI stays unchanged.

## 4. Strip CONTENT_PRINCIPLES from tool description

~400 tokens of guidance text was embedded in the tool description, present in every conversation's tool listing. This is disproportionate context cost for a tool that's used occasionally.

**Replacement**: concise 2-3 sentence tool description. Constant removed entirely from codebase (was dead code once removed from tool.ts).

## 5. Replace SettingsList with custom toggle list for /expert chat

The SettingsList component shows "on"/"off" text on the right side — designed for multi-value settings, not binary toggles. Hard to scan visually.

**Replacement**: custom toggle list with ○/● circles on the left, cursor indicator, bold selected row, and scroll support. Cleaner UX for a simple pin/unpin workflow.
