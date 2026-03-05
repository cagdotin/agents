import { run_completion } from "./llm.js";
import { format_conversation_for_router } from "./helpers.js";
import type { ExpertiseHeader, ExpertiseSettings, RouterResult } from "./types.js";

// ---------------------------------------------------------------------------
// Router prompt
// ---------------------------------------------------------------------------

const ROUTER_PROMPT = `You are a reflection router. Your job is to analyze a condensed conversation between a user and a coding agent, then identify which expertise domains were affected and what insights should be captured.

You will receive:
1. A list of expertise domains with their descriptions and scope paths
2. A condensed conversation (user messages, summarized assistant reasoning, tool calls as one-liners — NO tool output)

Your task:
1. Read through the conversation looking for:
   - User corrections ("we don't do it that way", "use X instead")
   - Architectural decisions and their reasoning
   - Non-obvious patterns or conventions discussed
   - Gotchas discovered during the work
2. Match these insights to the appropriate domains based on scope paths and descriptions
3. For each affected domain, extract 2-5 focused reflection points (brief bullet points)

Return your response in exactly this XML format:

<affected_domains>
  <domain name="domain-name-here">
    <points>
      - First insight or correction relevant to this domain
      - Second insight relevant to this domain
    </points>
  </domain>
</affected_domains>

If NO domains were meaningfully affected (e.g. the conversation was just questions, or unrelated to any domain), return:

<affected_domains />

IMPORTANT:
- Only include domains that had MEANINGFUL insights worth recording
- Do NOT include a domain just because files in its scope were touched — only if there's something worth learning
- Keep points brief and specific — these are attention signals for the domain expert, not the full analysis
- Use the exact domain names from the list provided`;

// ---------------------------------------------------------------------------
// Build router input (user message content)
// ---------------------------------------------------------------------------

export function build_router_input(
	domains: ExpertiseHeader[],
	condensed_conversation: string,
): string {
	const domain_list = domains.map((d) => {
		const paths = d.scope.paths.map((p) => `    - ${p}`).join("\n");
		return `- **${d.domain}**: ${d.description}\n  Scope paths:\n${paths}`;
	}).join("\n\n");

	return `## Available Domains

${domain_list}

## Conversation

${condensed_conversation}`;
}

// ---------------------------------------------------------------------------
// Parse router XML output
// ---------------------------------------------------------------------------

export function parse_router_output(output: string): RouterResult[] {
	// Check for empty result
	if (output.match(/<affected_domains\s*\/>/)) {
		return [];
	}

	const container_match = output.match(
		/<affected_domains>\s*([\s\S]*?)\s*<\/affected_domains>/,
	);
	if (!container_match) return [];

	const inner = container_match[1];
	const results: RouterResult[] = [];

	// Match each <domain name="..."><points>...</points></domain>
	const domain_regex = /<domain\s+name="([^"]+)">\s*<points>\s*([\s\S]*?)\s*<\/points>\s*<\/domain>/g;
	let match;

	while ((match = domain_regex.exec(inner)) !== null) {
		const domain = match[1].trim();
		const points = match[2].trim();
		if (domain && points) {
			results.push({ domain, points });
		}
	}

	return results;
}

// ---------------------------------------------------------------------------
// Run the router
// ---------------------------------------------------------------------------

export async function run_router(
	messages: any[],
	domains: ExpertiseHeader[],
	settings: ExpertiseSettings,
): Promise<RouterResult[] | { error: string }> {
	if (domains.length === 0) {
		return [];
	}

	// Build condensed conversation
	const condensed = format_conversation_for_router(messages);
	if (!condensed.trim()) {
		return { error: "No conversation content to route" };
	}

	// Build the user message content
	const user_text = build_router_input(domains, condensed);

	try {
		const output = await run_completion(
			ROUTER_PROMPT,
			user_text,
			settings.reflection_model || undefined,
		);
		const parsed = parse_router_output(output);

		// Validate that returned domain names actually exist
		const valid_names = new Set(domains.map((d) => d.domain));
		const validated = parsed.filter((r) => valid_names.has(r.domain));

		return validated;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { error: `Router failed: ${message}` };
	}
}
