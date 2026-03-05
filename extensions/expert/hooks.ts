import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
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
// In-memory state — cumulative set of domains loaded in the current session.
// Rebuilt from persisted CustomMessageEntry records on session lifecycle events.
// ---------------------------------------------------------------------------

const session_domains: Map<string, string> = new Map(); // domain → description

/**
 * Scan the current branch for expertise-loaded custom messages
 * and rebuild the in-memory tracking set.
 */
function rebuild_from_session(ctx: ExtensionContext): void {
	session_domains.clear();

	for (const entry of ctx.sessionManager.getBranch()) {
		if (
			entry.type === "custom_message" &&
			entry.customType === EXPERTISE_LOADED_MESSAGE_TYPE
		) {
			const details = entry.details as ExpertiseInjectionDetails | undefined;
			if (details?.domains) {
				for (const d of details.domains) {
					session_domains.set(d.domain, d.description);
				}
			}
		}
	}

	restore_status(ctx);
}

/**
 * Push the current domain set to the footer status bar.
 * Exported so the /expert reflect command can restore status after temporary overrides.
 */
export function restore_status(ctx: ExtensionContext): void {
	if (session_domains.size === 0) {
		ctx.ui.setStatus("expert", undefined);
		return;
	}
	const names = [...session_domains.keys()].join(", ");
	ctx.ui.setStatus("expert", `🧠 ${names}`);
}

// ---------------------------------------------------------------------------
// Register all event hooks
// ---------------------------------------------------------------------------

export function register_hooks(pi: ExtensionAPI): void {

	// --- Session lifecycle: rebuild state whenever the active branch changes ---

	pi.on("session_start", async (_event, ctx) => rebuild_from_session(ctx));
	pi.on("session_switch", async (_event, ctx) => rebuild_from_session(ctx));
	pi.on("session_tree", async (_event, ctx) => rebuild_from_session(ctx));
	pi.on("session_fork", async (_event, ctx) => rebuild_from_session(ctx));
	pi.on("session_compact", async (_event, ctx) => rebuild_from_session(ctx));

	// --- Injection: match expertise to prompt, inject into system prompt ------

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

		// Update in-memory tracking
		for (const d of loaded_domains) {
			session_domains.set(d.domain, d.description);
		}
		restore_status(ctx);

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
