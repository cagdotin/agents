---
name: pr-review
description: "Review a GitHub PR: fetch details, verify claims, analyze code changes for quality, security, correctness, and completeness."
---

# PR Review Skill

Review a GitHub pull request given its URL. Use the Github skill to fetch all data.

## Steps

### 1. Parse the PR URL

Extract `owner`, `repo`, and `pr_number` from the link (e.g. `https://github.com/owner/repo/pull/123`).

### 2. Fetch PR metadata

```bash
gh pr view <pr_number> --repo owner/repo --json title,body,author,baseRefName,headRefName,labels,reviewDecision,state,additions,deletions,changedFiles
```

Read and understand the PR title and description — these are the author's **claims** about what the PR does.

### 3. Fetch the diff

```bash
gh pr diff <pr_number> --repo owner/repo
```

If the diff is very large (>200 KB), fetch the file list first and review in batches:

```bash
gh pr diff <pr_number> --repo owner/repo --name-only
```

Then read individual files or hunks as needed.

### 4. Produce the review

Output a single structured review with the sections below. Keep it concise — bullet points, not essays.

---

#### Summary

One short paragraph: what does this PR *actually* do based on the diff?

#### Claims vs Reality

Compare the PR description against the actual changes.

- ✅ Confirmed claims — things the description says that the diff supports.
- ❌ Unsubstantiated claims — things described but not present in the diff.
- ⚠️ Undisclosed changes — things the diff does that the description doesn't mention.

Skip this section if the description is empty or trivially matches.

#### Change Analysis

For each changed file (or logical group of files), briefly note:
- What changed and why it likely changed.
- Anything unusual or risky.

#### Review Checklist

Evaluate every item below. Report only findings — skip items with nothing to flag.

| Area | What to look for |
|---|---|
| **Correctness** | Logic errors, off-by-ones, wrong conditions, unhandled branches, null/undefined access. |
| **Error handling** | Missing try/catch, swallowed errors, unhelpful error messages, missing fallback paths. |
| **Security** | Injection (SQL, XSS, command), auth/authz gaps, secrets in code, unsafe deserialization, missing input validation. |
| **Performance** | Unnecessary loops/allocations, N+1 queries, missing pagination, large payloads, missing caching where expected. |
| **Side effects** | Unintended state mutations, global changes, implicit ordering dependencies. |
| **Breaking changes** | Public API changes, config/env changes, DB schema changes without migration, removed exports. |
| **Race conditions** | Shared mutable state, concurrent access without guards, async ordering issues. |
| **Type safety** | Unsafe casts, `any` types, missing type narrowing, schema mismatches. |
| **Tests** | Missing tests for new logic, removed tests, insufficient edge-case coverage. |
| **Docs** | Missing or outdated README/comments/changelog entries for user-facing changes. |
| **Dependencies** | New deps (justified?), major version bumps, license concerns, unused deps left behind. |
| **Code quality** | Duplication, dead code, naming clarity, overly complex functions, magic numbers. |
| **Observability** | Missing or excessive logging, lost context in errors, missing metrics for critical paths. |
| **Accessibility** | (UI PRs) Missing labels, keyboard nav, contrast, ARIA attributes. |

#### Verdict

One of:

- **Approve** — no issues or only minor nits.
- **Request changes** — blocking issues that should be fixed before merge.
- **Comment** — non-blocking observations worth discussing.

List the top items that justify the verdict.

---

## Notes

- Be objective. Distinguish between *blocking issues* and *nits/suggestions*.
- When flagging a problem, reference the file and line from the diff.
- If context outside the diff is needed (e.g. to check if a deleted function is used elsewhere), checkout to branch and pull the changes.
- Do not nitpick formatting.
