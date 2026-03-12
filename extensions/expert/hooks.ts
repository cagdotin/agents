import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { EXPERTISE_PINNED_ENTRY_TYPE } from "./constants.js";
import { get_expertise_dir, list_domains, read_expertise, read_settings } from "./storage.js";
import type { ExpertiseInjectionDetails, ExpertisePinnedState, ExpertiseSkipDetails } from "./types.js";

// ---------------------------------------------------------------------------
// Custom message type for expertise injection notifications
// ---------------------------------------------------------------------------

export const EXPERTISE_LOADED_MESSAGE_TYPE = "expertise-loaded";
export const EXPERTISE_SKIPPED_MESSAGE_TYPE = "expertise-skipped";

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
 * Scan the current branch for pinned-domain entries and rebuild in-memory state.
 */
function rebuild_from_session(ctx: ExtensionContext): void {
	pinned_domains.clear();

	for (const entry of ctx.sessionManager.getBranch()) {
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
 * Push the current pinned domain set to the footer status bar.
 * Exported so the /expert command can restore status after temporary overrides.
 */
export function restore_status(ctx: ExtensionContext): void {
	if (pinned_domains.size > 0) {
		const pinned_names = [...pinned_domains.keys()].join(", ");
		ctx.ui.setStatus("expert", `📌 ${pinned_names}`);
	} else {
		ctx.ui.setStatus("expert", undefined);
	}
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

	// --- Injection: lightweight domain listing + pinned domain YAML ---

	pi.on("before_agent_start", async (event, ctx) => {
		const expertise_dir = get_expertise_dir(ctx.cwd);
		const domains = await list_domains(expertise_dir);
		if (domains.length === 0) return;

		const settings = await read_settings(expertise_dir);

		const context_usage = ctx.getContextUsage();
		const usage_percent =
			typeof context_usage?.percent === "number" && Number.isFinite(context_usage.percent)
				? context_usage.percent
				: undefined;

		// Critical threshold — skip all injection
		if (usage_percent !== undefined && usage_percent >= settings.max_context_percent_for_any_inject) {
			const usage_value = Math.round(usage_percent);
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

		// --- 1. Build compact domain listing ---
		const listing_lines = domains.map((d) => `- ${d.domain}: ${d.description || "(no description)"}`);

		// --- 2. Load pinned domains (full YAML injection) ---
		const loaded_domains: ExpertiseInjectionDetails["domains"] = [];
		const expertise_blocks: string[] = [];

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
		}

		// --- 3. Build system prompt injection ---
		const injection_parts = [
			"",
			"# Domain Expertise",
			"",
			"The following expertise files represent the agent's accumulated mental model for specific areas of this codebase. " +
				"Use this knowledge to orient yourself quickly, but always validate against the actual code — the code is the source of truth.",
			"",
		];

		if (expertise_blocks.length > 0) {
			// Pinned domains get full YAML
			injection_parts.push(...expertise_blocks, "");
		}

		if (listing_lines.length > 0) {
			// Non-pinned domains get a compact listing the agent can `get` on demand
			const non_pinned_listing = listing_lines.filter(
				(line) => !loaded_domains.some((d) => line.startsWith(`- ${d.domain}:`)),
			);
			if (non_pinned_listing.length > 0) {
				if (expertise_blocks.length > 0) {
					injection_parts.push("Other available domains (use `expertise get <domain>` to read):");
				} else {
					injection_parts.push("Available domains (use `expertise get <domain>` to read):");
				}
				injection_parts.push(...non_pinned_listing);
			}
		}

		injection_parts.push(
			"",
			"After completing your work, if you modified files in a domain's scope or gained new insights from the conversation, " +
				"consider using the `expertise` tool with action `append` to record non-obvious insights worth remembering.",
		);

		restore_status(ctx);

		const has_pinned = loaded_domains.length > 0;
		const domain_summary = has_pinned
			? `Loaded expertise: ${loaded_domains.map((d) => d.domain).join(", ")}`
			: `${domains.length} expertise domain(s) available`;

		return {
			systemPrompt: event.systemPrompt + injection_parts.join("\n"),
			message: {
				customType: EXPERTISE_LOADED_MESSAGE_TYPE,
				content: domain_summary,
				display: true,
				details: { domains: loaded_domains } satisfies ExpertiseInjectionDetails,
			},
		};
	});
}
