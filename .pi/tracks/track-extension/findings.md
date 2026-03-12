# Findings

- `summary.md` is a derived artifact; update the source track files and then resync instead of editing the summary directly.
- `.pi/tracks/settings.json` remembers the latest project-level selection, but session trace entries are the authority for which track the current session is actually attached to.
- The repo-agnostic constraint is easiest to preserve when policy lives in `extensions/tracks/templates/` and runtime logic only assumes `.pi/tracks/` exists.
- Deterministic sync is sufficient for v1 because the track schema is small and the summary can be rebuilt from structured markdown sections.
- Live testing exposed that using only `.pi/tracks/settings.json` for runtime binding lets one session accidentally affect another; hook behavior needs the session trace to be authoritative for the current session.
