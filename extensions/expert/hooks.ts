import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	get_expertise_dir,
	list_domains,
	read_expertise,
	read_settings,
} from "./storage.js";
import {
	match_domains_to_prompt,
	match_files_to_domains,
	extract_modified_files,
} from "./helpers.js";
import { run_reflection } from "./reflection.js";

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
		const expertise_blocks: string[] = [];
		for (const match of top_matches) {
			const record = await read_expertise(expertise_dir, match.domain.domain);
			if (!record) continue;
			expertise_blocks.push(
				`<expertise domain="${record.domain}">\n${record.raw}\n</expertise>`,
			);
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

		return {
			systemPrompt: event.systemPrompt + injection,
		};
	});
}

// ---------------------------------------------------------------------------
// agent_end — auto-reflect when files in a domain's scope were modified
// ---------------------------------------------------------------------------

export function register_auto_reflect_hook(pi: ExtensionAPI): void {
	pi.on("agent_end", async (event, ctx) => {
		const expertise_dir = get_expertise_dir(ctx.cwd);
		const settings = await read_settings(expertise_dir);

		if (!settings.auto_improve) return;

		const domains = await list_domains(expertise_dir);
		if (domains.length === 0) return;

		// Extract files modified during this agent cycle
		const messages = (event as any).messages ?? [];
		const modified_files = extract_modified_files(messages);
		if (modified_files.length === 0) return;

		// Match modified files to domains
		const matched_domains = match_files_to_domains(modified_files, domains, ctx.cwd);
		if (matched_domains.length === 0) return;

		// Run reflection in the background for each matched domain
		const session_file = ctx.sessionManager.getSessionFile() ?? "unknown";
		const branch_messages = ctx.sessionManager.getBranch()
			.filter((e: any) => e.type === "message")
			.map((e: any) => e.message);

		for (const domain of matched_domains) {
			// Show status while reflecting
			ctx.ui.setStatus("expert", `🧠 Reflecting on ${domain.domain}...`);

			try {
				const result = await run_reflection(
					pi,
					domain.domain,
					branch_messages,
					settings,
					ctx.cwd,
					session_file,
				);

				if ("error" in result) {
					ctx.ui.notify(`Expert reflect (${domain.domain}): ${result.error}`, "warning");
				} else {
					ctx.ui.notify(
						`🧠 Expertise updated: ${domain.domain}\n${result.summary}`,
						"info",
					);
				}
			} catch (err: any) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Expert reflect failed (${domain.domain}): ${message}`, "warning");
			} finally {
				ctx.ui.setStatus("expert", undefined);
			}
		}
	});
}
