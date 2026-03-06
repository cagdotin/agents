import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { EXPERTISE_PINNED_ENTRY_TYPE } from "./constants.js";
import { match_domains_to_prompt } from "./helpers.js";
import { get_expertise_dir, list_domains, read_expertise, read_settings } from "./storage.js";
import type { ExpertiseInjectionDetails, ExpertisePinnedState, ExpertiseSkipDetails } from "./types.js";

// ---------------------------------------------------------------------------
// Custom message type for expertise injection notifications
// ---------------------------------------------------------------------------

export const EXPERTISE_LOADED_MESSAGE_TYPE = "expertise-loaded";
export const EXPERTISE_SKIPPED_MESSAGE_TYPE = "expertise-skipped";

// ---------------------------------------------------------------------------
// In-memory state — cumulative set of domains loaded in the current session.
// Rebuilt from persisted CustomMessageEntry records on session lifecycle events.
// ---------------------------------------------------------------------------

const session_domains: Map<string, string> = new Map(); // domain → description

// ---------------------------------------------------------------------------
// Pinned domains — user-selected domains that always inject.
// Persisted via appendEntry, rebuilt on session lifecycle.
// ---------------------------------------------------------------------------

const pinned_domains: Map<string, string> = new Map(); // domain → description

/** Read the current pinned set. Used by the /expert chat command. */
export function get_pinned_domains(): Map<string, string> {
	return pinned_domains;
}

/** Replace the pinned set and persist. Used by the /expert chat command. */
export function set_pinned_domains(domains: Array<{ domain: string; description: string }>, pi: ExtensionAPI): void {
	pinned_domains.clear();
	for (const d of domains) {
		pinned_domains.set(d.domain, d.description);
	}
	pi.appendEntry<ExpertisePinnedState>(EXPERTISE_PINNED_ENTRY_TYPE, {
		domains,
	});
}

/**
 * Scan the current branch for expertise-loaded custom messages
 * and pinned-domain entries, then rebuild in-memory state.
 */
function rebuild_from_session(ctx: ExtensionContext): void {
	session_domains.clear();
	pinned_domains.clear();

	for (const entry of ctx.sessionManager.getBranch()) {
		// Rebuild session_domains from injection messages
		if (entry.type === "custom_message" && entry.customType === EXPERTISE_LOADED_MESSAGE_TYPE) {
			const details = entry.details as ExpertiseInjectionDetails | undefined;
			if (details?.domains) {
				for (const d of details.domains) {
					session_domains.set(d.domain, d.description);
				}
			}
		}

		// Rebuild pinned_domains from appendEntry records (last one wins)
		if (entry.type === "custom" && entry.customType === EXPERTISE_PINNED_ENTRY_TYPE) {
			const data = entry.data as ExpertisePinnedState | undefined;
			if (data?.domains) {
				pinned_domains.clear();
				for (const d of data.domains) {
					pinned_domains.set(d.domain, d.description);
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
	const parts: string[] = [];

	if (pinned_domains.size > 0) {
		const pinned_names = [...pinned_domains.keys()].join(", ");
		parts.push(`📌 ${pinned_names}`);
	}

	// Show auto-matched domains that aren't already pinned
	const auto_only = [...session_domains.keys()].filter((d) => !pinned_domains.has(d));
	if (auto_only.length > 0) {
		parts.push(`🧠 ${auto_only.join(", ")}`);
	}

	if (parts.length === 0) {
		ctx.ui.setStatus("expert", undefined);
		return;
	}

	ctx.ui.setStatus("expert", parts.join(" · "));
}

type ContextInjectionMode = "normal" | "tight" | "critical";

function get_context_injection_mode(
	usage_percent: number | undefined,
	auto_threshold: number,
	any_threshold: number,
): ContextInjectionMode {
	if (usage_percent === undefined) {
		return "normal";
	}
	if (usage_percent >= any_threshold) {
		return "critical";
	}
	if (usage_percent >= auto_threshold) {
		return "tight";
	}
	return "normal";
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

	// --- Injection: pinned domains + auto-matched, inject into system prompt ---

	pi.on("before_agent_start", async (event, ctx) => {
		const expertise_dir = get_expertise_dir(ctx.cwd);
		const settings = await read_settings(expertise_dir);

		const domains = await list_domains(expertise_dir);
		if (domains.length === 0) return;

		const context_usage = ctx.getContextUsage();
		const usage_percent =
			typeof context_usage?.percent === "number" && Number.isFinite(context_usage.percent)
				? context_usage.percent
				: undefined;
		const injection_mode = get_context_injection_mode(
			usage_percent,
			settings.max_context_percent_for_auto_inject,
			settings.max_context_percent_for_any_inject,
		);

		if (injection_mode === "critical") {
			const usage_value = Math.round(usage_percent ?? 100);
			const threshold = settings.max_context_percent_for_any_inject;
			const reason =
				`Skipped expertise injection: context is at ${usage_value}% ` + `(critical threshold: ${threshold}%).`;
			ctx.ui.notify(reason, "warning");

			return {
				message: {
					customType: EXPERTISE_SKIPPED_MESSAGE_TYPE,
					content: reason,
					display: true,
					details: {
						reason,
						usage_percent: usage_value,
						threshold_percent: threshold,
					} satisfies ExpertiseSkipDetails,
				},
			};
		}

		const prompt = event.prompt ?? "";

		// --- 1. Always load pinned domains (exempt from max_inject_domains) ---
		const loaded_domains: ExpertiseInjectionDetails["domains"] = [];
		const expertise_blocks: string[] = [];
		const loaded_set = new Set<string>();

		for (const [domain_name, pinned_description] of pinned_domains) {
			const record = await read_expertise(expertise_dir, domain_name);
			if (!record) continue;
			expertise_blocks.push(`<expertise domain="${record.domain}" pinned="true">\n${record.raw}\n</expertise>`);
			loaded_domains.push({
				domain: record.domain,
				description: pinned_description || record.description,
				pinned: true,
				related_domains: record.related_domains,
			});
			loaded_set.add(record.domain);
		}

		const should_auto_inject = injection_mode === "normal";

		// --- 2. Auto-inject additional domains based on prompt matching ---
		if (should_auto_inject && settings.auto_inject && prompt.trim()) {
			const matches = match_domains_to_prompt(prompt, domains);
			const auto_budget = settings.max_inject_domains;
			let auto_count = 0;

			for (const match of matches) {
				if (auto_count >= auto_budget) break;
				if (loaded_set.has(match.domain.domain)) continue; // already pinned

				const record = await read_expertise(expertise_dir, match.domain.domain);
				if (!record) continue;

				expertise_blocks.push(`<expertise domain="${record.domain}">\n${record.raw}\n</expertise>`);
				loaded_domains.push({
					domain: record.domain,
					description: match.domain.description || record.description,
					related_domains: record.related_domains,
				});
				loaded_set.add(record.domain);
				auto_count++;
			}
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
