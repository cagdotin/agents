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

export const REFLECTION_PROMPT = `You are an expertise reflection agent. Your job is to update a domain expertise file based on a conversation between a user and a coding agent.

The expertise file is a YAML "mental model" of a specific area of a codebase. It is NOT a source of truth — the code is. It is a working memory that helps the agent orient quickly.

You will receive:
1. The current expertise YAML file (may be minimal if newly created)
2. The conversation transcript

Your task:
1. Extract key insights from the conversation:
   - Corrections the user made ("we don't do it that way")
   - Architectural decisions and their reasoning
   - Patterns and conventions mentioned
   - Gotchas, edge cases, and things to watch out for
   - New files or components discovered
   - Relationships between parts of the system
2. Merge these insights into the existing expertise YAML
3. Preserve existing knowledge that wasn't contradicted
4. Remove or update knowledge that was corrected in the conversation

IMPORTANT RULES:
- Keep the YAML structure: domain, description, last_synced, scope at the top
- The agent-maintained sections (files, architecture, patterns, gotchas, etc.) are freeform — add/remove sections as needed
- Be concise. This is a mental model, not documentation
- Only include things that are genuinely useful for future work
- Do NOT invent information — only extract what's in the conversation

Return your response in exactly this format:

<updated_expertise>
(the complete updated YAML file)
</updated_expertise>

<reflection_summary>
(a brief summary of what changed and why, in markdown bullet points)
</reflection_summary>`;
