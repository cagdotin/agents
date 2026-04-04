import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, matchesKey, Text, visibleWidth } from "@mariozechner/pi-tui";
import { parse_init_args, validate_domain_name } from "./helpers.js";
import {
	EXPERTISE_LOADED_MESSAGE_TYPE,
	EXPERTISE_SKIPPED_MESSAGE_TYPE,
	get_pinned_domains,
	register_hooks,
	restore_status,
	set_pinned_domains,
} from "./hooks.js";
import {
	build_skeleton_yaml,
	ensure_expertise_dir,
	get_expertise_dir,
	get_expertise_dir_label,
	list_domains,
	read_expertise,
	write_expertise,
} from "./storage.js";
import { create_expertise_tool } from "./tool.js";
import type { ExpertiseInjectionDetails, ExpertiseSkipDetails } from "./types.js";

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
	pi.registerMessageRenderer<ExpertiseInjectionDetails>(EXPERTISE_LOADED_MESSAGE_TYPE, (message, options, theme) => {
		const details = message.details;
		if (!details?.domains?.length) {
			// No pinned domains — show a compact "available" notice
			const text = `${theme.fg("customMessageLabel", "📚 expertise")} ${theme.fg("dim", message.content ?? "")}`;
			const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
			box.addChild(new Text(text, 0, 0));
			return box;
		}

		const parts: string[] = [];
		const pinned = details.domains.filter((d) => d.pinned);

		if (pinned.length > 0) {
			const pinned_list = pinned.map((d) => theme.fg("accent", d.domain)).join(theme.fg("dim", ", "));
			parts.push(`${theme.fg("customMessageLabel", "📌 pinned")} ${pinned_list}`);
		}

		const lines = [parts.join(theme.fg("dim", " · "))];

		if (options.expanded) {
			for (const domain of details.domains) {
				if (!domain.related_domains || domain.related_domains.length === 0) continue;
				lines.push(
					`${theme.fg("dim", "↗ related ")}${theme.fg("accent", domain.domain)}${theme.fg("dim", ": ")}${theme.fg("muted", domain.related_domains.join(", "))}`,
				);
			}
		}

		const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
		for (let i = 0; i < lines.length; i++) {
			box.addChild(new Text(lines[i], 0, i));
		}
		return box;
	});

	pi.registerMessageRenderer<ExpertiseSkipDetails>(EXPERTISE_SKIPPED_MESSAGE_TYPE, (message, _options, theme) => {
		const details = message.details;
		if (!details) return undefined;

		const text =
			theme.fg("customMessageLabel", "⚠ expertise") +
			" " +
			theme.fg("warning", `skipped at ${details.usage_percent}% (threshold ${details.threshold_percent}%)`);

		const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
		box.addChild(new Text(text, 0, 0));
		return box;
	});

	// Register the /expert command
	pi.registerCommand("expert", {
		description: "Manage domain expertise — list, chat, and init",

		getArgumentCompletions: (prefix: string) => {
			const sub_commands = ["chat", "list", "init"];
			const filtered = sub_commands.filter((c) => c.startsWith(prefix));
			if (filtered.length > 0) {
				return filtered.map((c) => ({
					value: c,
					label: c,
					description:
						c === "chat"
							? "Select experts to pin for this conversation"
							: c === "init"
								? "Initialize a domain from the command line"
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
					ctx.ui.notify("No expertise domains found. Ask the agent to initialize one with the expertise tool.", "info");
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

			// /expert init <domain> <scope_path> [--description "..."]
			if (trimmed === "init" || trimmed.startsWith("init ")) {
				const init_args = parse_init_args(trimmed);
				if (init_args.error) {
					ctx.ui.notify(init_args.error, "warning");
					return;
				}

				const domain_validation = validate_domain_name(init_args.domain);
				if (!domain_validation.valid) {
					ctx.ui.notify(`Invalid domain name: ${domain_validation.error}`, "warning");
					return;
				}

				const existing_domain = await read_expertise(expertise_dir, init_args.domain);
				if (existing_domain) {
					ctx.ui.notify(
						`Domain '${init_args.domain}' already exists. Use /expert list or the expertise update action.`,
						"warning",
					);
					return;
				}

				const used_default_description = !init_args.description;
				const description =
					init_args.description ??
					`Temporary description for ${init_args.domain}. Replace this with a precise scope summary.`;

				const skeleton_yaml = build_skeleton_yaml(init_args.domain, description, [init_args.scope_path]);
				await write_expertise(expertise_dir, init_args.domain, skeleton_yaml);

				const description_note = used_default_description
					? "\n⚠ Description was auto-generated. Please refine it soon."
					: "";
				ctx.ui.notify(
					`Initialized domain '${init_args.domain}' at ${init_args.scope_path}.${description_note}\n` +
						"Next: ask the agent to read key files and populate the expertise file.",
					"info",
				);
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
					ctx.ui.notify("No expertise domains found. Ask the agent to initialize one with the expertise tool.", "info");
					return;
				}

				const current_pinned = get_pinned_domains();

				// Track selections as user toggles
				const selections = new Map<string, boolean>();
				for (const d of domains) {
					selections.set(d.domain, current_pinned.has(d.domain));
				}

				await ctx.ui.custom((_tui, theme, _kb, done) => {
					let selected_index = 0;
					const max_visible = Math.min(domains.length, 15);

					function commit() {
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
					}

					return {
						render(width: number) {
							const lines: string[] = [
								theme.fg("accent", theme.bold("  Select Experts")),
								theme.fg("dim", "  Toggle domains to pin for this conversation"),
								"",
							];

							// Compute scroll window
							let start = 0;
							if (domains.length > max_visible) {
								start = Math.max(
									0,
									Math.min(selected_index - Math.floor(max_visible / 2), domains.length - max_visible),
								);
							}
							const end = Math.min(start + max_visible, domains.length);

							for (let i = start; i < end; i++) {
								const d = domains[i];
								const is_selected = i === selected_index;
								const is_on = selections.get(d.domain) ?? false;
								const circle = is_on ? theme.fg("accent", "●") : theme.fg("dim", "○");
								const cursor = is_selected ? theme.fg("accent", " ❯ ") : "   ";
								const label = `${d.domain} ${theme.fg("dim", "—")} ${theme.fg("muted", d.description || "(no description)")}`;
								const max_label_width = width - visibleWidth(cursor) - visibleWidth(circle) - 2;
								const display_label =
									visibleWidth(label) > max_label_width ? `${label.slice(0, max_label_width - 1)}…` : label;
								lines.push(`${cursor}${circle} ${is_selected ? theme.bold(display_label) : display_label}`);
							}

							lines.push("", theme.fg("dim", "  enter/space toggle • ↑/↓ navigate • esc confirm"));
							return lines;
						},
						invalidate() {},
						handleInput(data: string) {
							if (matchesKey(data, "up")) {
								selected_index = Math.max(0, selected_index - 1);
							} else if (matchesKey(data, "down")) {
								selected_index = Math.min(domains.length - 1, selected_index + 1);
							} else if (matchesKey(data, "enter") || matchesKey(data, "space")) {
								const d = domains[selected_index];
								selections.set(d.domain, !selections.get(d.domain));
							} else if (matchesKey(data, "escape")) {
								commit();
								return;
							}
							_tui.requestRender();
						},
					};
				});

				return;
			}

			ctx.ui.notify('Usage: /expert [list | chat [clear] | init <domain> <scope_path> [--description "..."]]', "info");
		},
	});
}
