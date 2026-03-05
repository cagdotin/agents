export const EXPERTISE_DIR_NAME = ".pi/expertise";
export const EXPERTISE_PATH_ENV = "PI_EXPERTISE_PATH";
export const SETTINGS_FILE_NAME = "settings.json";
export const REFLECTIONS_LOG_NAME = ".reflections.log";

export const DEFAULT_SETTINGS = {
	auto_inject: true,
	auto_improve: true,
	reflection_model: "",
	max_inject_domains: 2,
};

export const DOMAIN_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Content principles — shared between tool guidance and reflection prompt
// ---------------------------------------------------------------------------

export const CONTENT_PRINCIPLES = `WHAT BELONGS in expertise (hard to discover, saves real time):
- WHY things are the way they are — reasoning, tradeoffs, constraints
- Non-obvious patterns and conventions that would surprise a new developer
- Gotchas that actually bite — things you'd only learn by getting burned
- Brief orientation — just enough to know where to dig deeper
- "For X see path/to/file" pointers — progressive disclosure, not duplication

WHAT DOES NOT BELONG (the 10-second rule — if you can figure it out by looking at the code, skip it):
- File listings or directory structures — the agent can ls
- Function names, exports, or API inventories — the agent can grep
- Implementation details that are obvious from reading the code
- Step-by-step patterns that can be copied from existing code
- Anything that duplicates what the code already says clearly

The test: would a developer need 30 minutes of archaeology to understand this? Include it.
Could they figure it out in 10 seconds by reading the code? Leave it out.
When in doubt, leave it out — less is more. A shorter expertise file is a better expertise file.

WHEN EXPERTISE IS HARD TO TRIM — diagnose the root cause:
If a domain's expertise keeps growing beyond 60-80 lines and nothing can reasonably be cut,
that is a signal about the codebase, not the expertise. Flag it. Common root causes:
- The domain scope is too broad — split it into smaller domains
- The code lacks documentation — inline comments or a README would eliminate half the gotchas
- Poor naming or structure forces too many "watch out for X" entries — suggest refactoring
- Too many implicit conventions that should be made explicit in the code itself
Add a "codebase_concerns" section when you spot these patterns — the expertise should
advocate for making itself unnecessary, not just document the mess.`;

export const REFLECTION_PROMPT = `You are an expertise reflection agent. Your job is to update a domain expertise file based on a conversation between a user and a coding agent.

The expertise file is a YAML "mental model" of a specific area of a codebase. It works like a developer's brain — you don't memorize code, you know where things roughly are, why they're that way, and what to watch out for. Everything else you look up on demand.

The code is always the source of truth. Expertise is just a shortcut to avoid re-discovering things.

You will receive:
1. The current expertise YAML file (may be minimal if newly created)
2. The conversation transcript

Your task:
1. Extract key insights from the conversation — prioritize:
   - Corrections the user made ("we don't do it that way")
   - Architectural decisions and their reasoning (the WHY)
   - Non-obvious gotchas the developer got burned by
   - Conventions that aren't obvious from the code
2. Merge these insights into the existing expertise YAML
3. Preserve existing knowledge that wasn't contradicted
4. Remove or update knowledge that was corrected in the conversation
5. ACTIVELY TRIM bloat — remove anything that violates the content principles below
6. DIAGNOSE — if the expertise is large and hard to trim, ask why. Add a "codebase_concerns"
   section flagging structural issues (scope too broad, missing docs, poor naming, implicit
   conventions that should be explicit in code). The goal is to make the expertise unnecessary
   over time, not to document every quirk forever.

STRUCTURE RULES:
- Keep the YAML header: domain, description, last_synced, scope
- Recommended sections: overview, patterns, gotchas, design_decisions, references
- Sections are freeform — add/remove as needed. Fewer sections is fine.

CONTENT PRINCIPLES:
${CONTENT_PRINCIPLES}

TRIMMING RULES — apply these aggressively on every reflection:
- Review EVERY item in the existing expertise and ask: "does this pass the 10-second rule?"
- Remove patterns that are just describing what the code does (the code already says that)
- Remove implementation details that are visible from reading the files
- Merge overlapping items — don't repeat the same insight in different words
- Prefer 3 sharp insights over 10 vague ones
- A good expertise file is typically 30-60 lines, not 100+

Return your response in exactly this format:

<updated_expertise>
(the complete updated YAML file)
</updated_expertise>

<reflection_summary>
(a brief summary of what changed and why, in markdown bullet points)
</reflection_summary>`;
