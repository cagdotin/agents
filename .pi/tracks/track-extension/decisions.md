# Decisions

- Use extension-owned markdown templates as the workspace policy surface instead of inline template strings hidden in code.
- Keep `summary.md` deterministic in v1; do not depend on LLM summarization for sync.
- Split active-track state between `.pi/tracks/settings.json` (latest project-level selection) and session trace entries (authority for the current session's attached track).
- Treat `report.md` as a live artifact during execution and finalize it only when the track closes.
- Treat a track as an ongoing workstream/initiative context that can span multiple sessions and milestones; finishing one subtask does not imply the track should close.
- Exclude `.pi/tracks/settings.json` from formatter-driven quality gates because it is mutable runtime state rather than source code.
- Use milestone 2 to improve deterministic lifecycle summaries/status output before expanding scope into handoffs or sub-agent orchestration.
- Keep the extension scoped to `.pi/tracks/` plus session trace entries so it remains portable across repositories.
- Resolve the current session's attached track from session trace entries, not from `.pi/tracks/settings.json`, so parallel Pi sessions do not steal each other's runtime context or shutdown sync target.
