Create **multiple atomic git commits** for the current changes using conventional commits. **Never** combine unrelated changes into a single commit—group semantically related changes (one logical unit per commit).

## Format (per commit)

`<type>[<scope>]: <summary>`

- type REQUIRED. Use feat for new features, fix for bug fixes. Other common types: docs, refactor, chore, test, perf.
- scope OPTIONAL. Short noun in parentheses for the affected area (e.g., api, parser, ui).
- summary REQUIRED. Short, imperative, <= 72 chars, no trailing period.

## Notes

- the body is OPTIONAL. if needed, add a blank line after the subject and write short paragraphs
- Do NOT include breaking-change markers or footers.
- Do NOT add sign-offs (no Signed-off-by).
- Only commit; do NOT push.
- **Atomicity rule**: Each commit must represent one complete, independent change (e.g., one feature + its tests; docs separately; refactors separately). Buildable/tests passing after each.

## Steps

1. Run `git status` and `git diff` to review **all** unstaged/untracked changes.
2. Analyze the diff to group changes into **logical atomic units**:
   - Separate features, fixes, tests, docs, refactors, etc.
   - Hunk-level granularity if needed (e.g., use `git add -p` for precision).
3. (optional) `git log -n 50 --pretty=format:%s` to see commonly used scopes.
4. If there are ambiguous extra files, ask the user for clarification before committing.
5. Run git commit -m "<subject>" (and -m "<body>" if needed).

