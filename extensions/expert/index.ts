import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	get_expertise_dir,
	get_expertise_dir_label,
	ensure_expertise_dir,
	list_domains,
	read_settings,
} from "./storage.js";
import { run_reflection } from "./reflection.js";
import { create_expertise_tool } from "./tool.js";
import { register_injection_hook, register_auto_reflect_hook } from "./hooks.js";

export default function expert_extension(pi: ExtensionAPI) {
	const dir_label = get_expertise_dir_label(process.cwd());

	// Ensure the expertise directory exists on session start
	pi.on("session_start", async (_event, ctx) => {
		const expertise_dir = get_expertise_dir(ctx.cwd);
		await ensure_expertise_dir(expertise_dir);
	});

	// Register the expertise tool
	pi.registerTool(create_expertise_tool(pi, dir_label));

	// Register event hooks
	register_injection_hook(pi);
	register_auto_reflect_hook(pi);

	// Register the /expert command
	pi.registerCommand("expert", {
		description: "Manage domain expertise — list domains, or 'reflect <domain>' to trigger reflection",

		getArgumentCompletions: (prefix: string) => {
			const sub_commands = ["reflect", "list"];
			const filtered = sub_commands.filter((c) => c.startsWith(prefix));
			if (filtered.length > 0) {
				return filtered.map((c) => ({
					value: c,
					label: c,
					description: c === "reflect"
						? "Reflect on conversation and update expertise"
						: "List all expertise domains",
				}));
			}
			return null;
		},

		handler: async (args, ctx) => {
			const expertise_dir = get_expertise_dir(ctx.cwd);
			const trimmed = (args ?? "").trim();

			// /expert (no args) — list domains
			if (!trimmed || trimmed === "list") {
				const domains = await list_domains(expertise_dir);
				if (domains.length === 0) {
					ctx.ui.notify(
						"No expertise domains found. Ask the agent to initialize one with the expertise tool.",
						"info",
					);
					return;
				}

				const lines = domains.map(
					(d) => `  ${d.domain} — ${d.description || "(no description)"} (synced: ${d.last_synced || "never"})`,
				);
				ctx.ui.notify(`Expertise domains:\n${lines.join("\n")}`, "info");
				return;
			}

			// /expert reflect [domain]
			if (trimmed.startsWith("reflect")) {
				const domain_arg = trimmed.slice("reflect".length).trim();

				// If no domain specified, let user pick
				let target_domain = domain_arg;
				if (!target_domain) {
					const domains = await list_domains(expertise_dir);
					if (domains.length === 0) {
						ctx.ui.notify("No expertise domains to reflect on.", "info");
						return;
					}

					if (domains.length === 1) {
						target_domain = domains[0].domain;
					} else {
						const choices = domains.map((d) => `${d.domain} — ${d.description}`);
						const selected = await ctx.ui.select("Reflect on which domain?", choices);
						if (selected === undefined) return;
						target_domain = domains[selected].domain;
					}
				}

				ctx.ui.setStatus("expert", `🧠 Reflecting on ${target_domain}...`);

				try {
					const settings = await read_settings(expertise_dir);
					const session_file = ctx.sessionManager.getSessionFile() ?? "unknown";
					const branch_messages = ctx.sessionManager.getBranch()
						.filter((e: any) => e.type === "message")
						.map((e: any) => e.message);

					const result = await run_reflection(
						pi,
						target_domain,
						branch_messages,
						settings,
						ctx.cwd,
						session_file,
					);

					if ("error" in result) {
						ctx.ui.notify(`Reflection failed: ${result.error}`, "error");
					} else {
						ctx.ui.notify(
							`🧠 Expertise updated: ${target_domain}\n\n${result.summary}`,
							"info",
						);
					}
				} catch (err: any) {
					const message = err instanceof Error ? err.message : String(err);
					ctx.ui.notify(`Reflection failed: ${message}`, "error");
				} finally {
					ctx.ui.setStatus("expert", undefined);
				}
				return;
			}

			ctx.ui.notify(
				"Usage: /expert [list | reflect <domain>]",
				"info",
			);
		},
	});
}
