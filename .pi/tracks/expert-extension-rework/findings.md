# Findings

## Context cost breakdown

- Each domain YAML: typically 40-120 lines → 300-1000 tokens
- Injection header/footer: ~200 tokens
- `CONTENT_PRINCIPLES` in tool description: ~400 tokens (always present)
- With 2-3 auto-matched domains: easily 1500-3000+ tokens per turn
- This cost is paid even when expertise is irrelevant to the current task

## Reflection pipeline is 1+N LLM calls

Each reflection triggers a router call (conversation + all domain headers) plus one call per affected domain (conversation + current YAML). Each call spawns a `pi -p` subprocess. For a repo with 5 domains where 2 are affected, that's 3 subprocess spawns.

## Auto-matching heuristics are fragile

The scoring system (`match_domains_to_prompt`) uses a weighted sum of substring matches across domain names (+10), aliases (+8), scope paths (+8), scope patterns (+6), keywords (+4), and description words (+2). Threshold is score ≥ 6. This means two description word matches can trigger injection — very noisy.

## Reflection output parsing is regex-based

Both router and reflection use regex to extract XML tags from LLM output. If the model drifts slightly in formatting (extra whitespace, attribute order), parsing silently fails and returns null/empty.
