# PR Review Workflow

Review a GitHub pull request given its URL.

Use `gh` to fetch the PR data, then load `/skill:review` for the actual code analysis.
This workflow owns the GitHub-specific ceremony: fetching metadata, comparing claims to the diff, and producing a PR verdict.

## Steps

### 1. Parse the PR URL

Extract `owner`, `repo`, and `pr_number` from the link (for example `https://github.com/owner/repo/pull/123`).

### 2. Fetch PR metadata

```bash
gh pr view <pr_number> --repo owner/repo --json title,body,author,baseRefName,headRefName,labels,reviewDecision,state,additions,deletions,changedFiles
```

Read and understand the PR title and description — these are the author's claims about what the PR does.

### 3. Fetch the diff

```bash
gh pr diff <pr_number> --repo owner/repo
```

If the diff is very large (>200 KB), fetch the file list first and review in batches:

```bash
gh pr diff <pr_number> --repo owner/repo --name-only
```

Then read individual files or hunks as needed.

### 4. Run the code review

Load `/skill:review` and apply it to the PR diff.

- Use the PR diff as the review scope.
- Gather any extra repository context needed to understand risky changes.
- Reuse the core report format defined by `/skill:review` for findings.
- Focus on concrete findings with file/line references from the diff.

If `/skill:review` is unavailable, do a minimal fallback review for correctness, security, testing gaps, and breaking changes.

### 5. Produce the PR review output

Output one concise structured review with these sections:

#### Summary

One short paragraph: what the PR actually does based on the diff.

#### Claims vs Reality

Compare the PR description against the actual changes.

- ✅ Confirmed claims — the description says it and the diff supports it.
- ❌ Unsubstantiated claims — the description says it but the diff does not show it.
- ⚠️ Undisclosed changes — the diff does something the description does not mention.

Skip this section if the description is empty or trivially matches.

#### Change Analysis

For each changed file or logical file group, briefly note:
- what changed
- why it likely changed
- anything unusual or risky

#### Findings

Insert the core findings produced by `/skill:review`, grouped by lens.

#### Verdict

Choose one:

- **Approve** — no issues or only minor nits
- **Request Changes** — blocking issues should be fixed before merge
- **Comment** — non-blocking observations worth discussing

List the top items that justify the verdict.

## Notes

- Be objective. Distinguish clearly between blocking issues and non-blocking suggestions.
- Do not nitpick formatting.
- If context outside the diff is needed, inspect surrounding files or check out the branch before concluding.
- Keep PR-specific framing here; keep reusable review methodology in `/skill:review`.
