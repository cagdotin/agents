import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Box, Container, type SettingItem, SettingsList, Text } from "@mariozechner/pi-tui";
import {
	get_expertise_dir,
	get_expertise_dir_label,
	ensure_expertise_dir,
	list_domains,
	read_settings,
} from "./storage.js";
import { run_reflection_pipeline } from "./reflection.js";
import { create_expertise_tool } from "./tool.js";
import {
	register_hooks,
	EXPERTISE_LOADED_MESSAGE_TYPE,
	restore_status,
	get_pinned_domains,
	set_pinned_domains,
} from "./hooks.js";
import type { ExpertiseInjectionDetails } from "./types.js";

export default function expert_extension(pi: ExtensionAPI) {
	const dir_label = get_expertise_dir_label(process.cwd());

	// Ensure the expertise directory exists on session start
	pi.on("session_start", async (_event, ctx) => {
		const expertise_dir = get_expertise_dir(ctx.cwd);
		await ensure_expertise_dir(expertise_dir);
	});

	// Register the expertise tool
	pi.registerTool(create_expertise_tool(dir_label));

	// Register event hooks (injection, session lifecycle, status tracking)
	register_hooks(pi);

	// Register message renderer for expertise injection notifications
	pi.registerMessageRenderer<ExpertiseInjectionDetails>(
		EXPERTISE_LOADED_MESSAGE_TYPE,
		(message, _options, theme) => {
			const details = message.details;
			if (!details?.domains?.length) return undefined;

			const parts: string[] = [];
			const pinned = details.domains.filter((d) => d.pinned);
			const auto = details.domains.filter((d) => !d.pinned);

			if (pinned.length > 0) {
				const pinned_list = pinned
					.map((d) => theme.fg("accent", d.domain))
					.join(theme.fg("dim", ", "));
				parts.push(`${theme.fg("customMessageLabel", "📌 pinned")} ${pinned_list}`);
			}

			if (auto.length > 0) {
				const auto_list = auto
					.map((d) => theme.fg("accent", d.domain))
					.join(theme.fg("dim", ", "));
				parts.push(`${theme.fg("customMessageLabel", "🧠 expertise")} ${auto_list}`);
			}

			const text = parts.join(theme.fg("dim", " · "));

			const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
			box.addChild(new Text(text, 0, 0));
			return box;
		},
	);

	// Register the /expert command
	pi.registerCommand("expert", {
		description: "Manage domain expertise — list, reflect, or chat with experts",

		getArgumentCompletions: (prefix: string) => {
			const sub_commands = ["chat", "reflect", "list"];
			const filtered = sub_commands.filter((c) => c.startsWith(prefix));
			if (filtered.length > 0) {
				return filtered.map((c) => ({
					value: c,
					label: c,
					description:
						c === "chat" ? "Select experts to pin for this conversation" :
						c === "reflect" ? "Reflect on conversation and update expertise" :
						"List all expertise domains",
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

				const pinned = get_pinned_domains();
				const lines = domains.map((d) => {
					const pin = pinned.has(d.domain) ? "📌 " : "   ";
					return `${pin}${d.domain} — ${d.description || "(no description)"} (synced: ${d.last_synced || "never"})`;
				});
				ctx.ui.notify(`Expertise domains:\n${lines.join("\n")}`, "info");
				return;
			}

			// /expert chat [clear]
			if (trimmed === "chat" || trimmed.startsWith("chat ")) {
				const chat_arg = trimmed.slice("chat".length).trim();

				// /expert chat clear — unpin everything
				if (chat_arg === "clear") {
					set_pinned_domains([], pi);
					restore_status(ctx);
					ctx.ui.notify("Cleared all pinned experts.", "info");
					return;
				}

				const domains = await list_domains(expertise_dir);
				if (domains.length === 0) {
					ctx.ui.notify(
						"No expertise domains found. Ask the agent to initialize one with the expertise tool.",
						"info",
					);
					return;
				}

				const current_pinned = get_pinned_domains();

				// Build settings items — each domain is a toggle
				const items: SettingItem[] = domains.map((d) => ({
					id: d.domain,
					label: `${d.domain} — ${d.description || "(no description)"}`,
					currentValue: current_pinned.has(d.domain) ? "on" : "off",
					values: ["on", "off"],
				}));

				// Track selections as user toggles
				const selections = new Map<string, boolean>();
				for (const d of domains) {
					selections.set(d.domain, current_pinned.has(d.domain));
				}

				await ctx.ui.custom((_tui, theme, _kb, done) => {
					const container = new Container();
					container.addChild(
						new (class {
							render(_width: number) {
								return [
									theme.fg("accent", theme.bold("  Select Experts")),
									theme.fg("dim", "  Toggle domains to pin for this conversation"),
									"",
								];
							}
							invalidate() {}
						})(),
					);

					const settings_list = new SettingsList(
						items,
						Math.min(items.length + 2, 15),
						getSettingsListTheme(),
						(id, new_value) => {
							selections.set(id, new_value === "on");
						},
						() => {
							// On close — persist selections
							const new_pinned: Array<{ domain: string; description: string }> = [];
							for (const d of domains) {
								if (selections.get(d.domain)) {
									new_pinned.push({ domain: d.domain, description: d.description });
								}
							}
							set_pinned_domains(new_pinned, pi);
							restore_status(ctx);

							if (new_pinned.length > 0) {
								const names = new_pinned.map((d) => d.domain).join(", ");
								ctx.ui.notify(`📌 Pinned experts: ${names}`, "info");
							} else {
								ctx.ui.notify("No experts pinned.", "info");
							}

							done(undefined);
						},
						{ enableSearch: true },
					);

					container.addChild(settings_list);

					container.addChild(
						new (class {
							render(_width: number) {
								return [
									"",
									theme.fg("dim", "  ←/→ toggle • ↑/↓ navigate • / search • esc confirm"),
								];
							}
							invalidate() {}
						})(),
					);

					return {
						render: (w: number) => container.render(w),
						invalidate: () => container.invalidate(),
						handleInput: (data: string) => {
							settings_list.handleInput?.(data);
							_tui.requestRender();
						},
					};
				});

				return;
			}

			// /expert reflect [domain]
			if (trimmed.startsWith("reflect")) {
				const domain_arg = trimmed.slice("reflect".length).trim() || undefined;

				ctx.ui.setStatus("expert", domain_arg
					? `🧠 Reflecting on ${domain_arg}...`
					: "🧠 Router: identifying affected domains...",
				);

				try {
					const settings = await read_settings(expertise_dir);
					const session_file = ctx.sessionManager.getSessionFile() ?? "unknown";
					const branch_messages = ctx.sessionManager.getBranch()
						.filter((e: any) => e.type === "message")
						.map((e: any) => e.message);

					const pipeline = await run_reflection_pipeline(
						branch_messages,
						settings,
						ctx.cwd,
						session_file,
						domain_arg,
						(status) => ctx.ui.setStatus("expert", status),
					);

					if (pipeline.results.length === 0) {
						const msg = pipeline.router_skipped
							? "No results from reflection."
							: "Router found no domains affected by this conversation.";
						ctx.ui.notify(msg, "info");
						return;
					}

					const successes = pipeline.results.filter((r) => !r.error);
					const failures = pipeline.results.filter((r) => r.error);

					const parts: string[] = [];
					if (successes.length > 0) {
						parts.push("🧠 Expertise updated:");
						for (const r of successes) {
							parts.push(`  ${r.domain}: ${r.summary}`);
						}
					}
					if (failures.length > 0) {
						parts.push("Failed:");
						for (const r of failures) {
							parts.push(`  ${r.domain}: ${r.error}`);
						}
					}

					ctx.ui.notify(parts.join("\n"), failures.length > 0 ? "warning" : "info");
				} catch (err: any) {
					const message = err instanceof Error ? err.message : String(err);
					ctx.ui.notify(`Reflection failed: ${message}`, "error");
				} finally {
					restore_status(ctx);
				}
				return;
			}

			ctx.ui.notify(
				"Usage: /expert [list | chat [clear] | reflect <domain>]",
				"info",
			);
		},
	});
}
