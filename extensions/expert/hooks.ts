import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	get_expertise_dir,
	list_domains,
	read_expertise,
	read_settings,
} from "./storage.js";
import {
	match_domains_to_prompt,
} from "./helpers.js";
import type { ExpertiseInjectionDetails } from "./types.js";

// ---------------------------------------------------------------------------
// Custom message type for expertise injection notifications
// ---------------------------------------------------------------------------

export const EXPERTISE_LOADED_MESSAGE_TYPE = "expertise-loaded";

// ---------------------------------------------------------------------------
// before_agent_start — inject matching expertise into system prompt
// ---------------------------------------------------------------------------

export function register_injection_hook(pi: ExtensionAPI): void {
	pi.on("before_agent_start", async (event, ctx) => {
		const expertise_dir = get_expertise_dir(ctx.cwd);
		const settings = await read_settings(expertise_dir);

		if (!settings.auto_inject) return;

		const domains = await list_domains(expertise_dir);
		if (domains.length === 0) return;

		const prompt = event.prompt ?? "";
		if (!prompt.trim()) return;

		// Score domains against the prompt
		const matches = match_domains_to_prompt(prompt, domains);
		if (matches.length === 0) return;

		// Take top N domains
		const top_matches = matches.slice(0, settings.max_inject_domains);

		// Load full expertise for matched domains
		const loaded_domains: ExpertiseInjectionDetails["domains"] = [];
		const expertise_blocks: string[] = [];
		for (const match of top_matches) {
			const record = await read_expertise(expertise_dir, match.domain.domain);
			if (!record) continue;
			expertise_blocks.push(
				`<expertise domain="${record.domain}">\n${record.raw}\n</expertise>`,
			);
			loaded_domains.push({
				domain: record.domain,
				description: match.domain.description,
			});
		}

		if (expertise_blocks.length === 0) return;

		const injection = [
			"",
			"# Domain Expertise",
			"",
			"The following expertise files represent the agent's accumulated mental model for specific areas of this codebase. " +
			"Use this knowledge to orient yourself quickly, but always validate against the actual code — the code is the source of truth.",
			"",
			...expertise_blocks,
			"",
			"After completing your work, if you modified files in a domain's scope or gained new insights from the conversation, " +
			"consider using the `expertise` tool with action `reflect` to update the domain's mental model.",
		].join("\n");

		const domain_names = loaded_domains.map((d) => d.domain).join(", ");

		return {
			systemPrompt: event.systemPrompt + injection,
			message: {
				customType: EXPERTISE_LOADED_MESSAGE_TYPE,
				content: `Loaded expertise: ${domain_names}`,
				display: true,
				details: { domains: loaded_domains } satisfies ExpertiseInjectionDetails,
			},
		};
	});
}

