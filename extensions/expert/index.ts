import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Box, Container, type SettingItem, SettingsList, Text } from "@mariozechner/pi-tui";
import { DEFAULT_REFLECTION_LOG_LIMIT, MAX_REFLECTION_LOG_LIMIT } from "./constants.js";
import { validate_domain_name } from "./helpers.js";
import {
	EXPERTISE_LOADED_MESSAGE_TYPE,
	EXPERTISE_SKIPPED_MESSAGE_TYPE,
	get_pinned_domains,
	register_hooks,
	restore_status,
	set_pinned_domains,
} from "./hooks.js";
import { run_reflection_pipeline } from "./reflection.js";
import {
	build_skeleton_yaml,
	ensure_expertise_dir,
	get_expertise_dir,
	get_expertise_dir_label,
	list_domains,
	read_expertise,
	read_reflection_log,
	read_settings,
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
		if (!details?.domains?.length) return undefined;

		const parts: string[] = [];
		const pinned = details.domains.filter((d) => d.pinned);
		const auto = details.domains.filter((d) => !d.pinned);

		if (pinned.length > 0) {
			const pinned_list = pinned.map((d) => theme.fg("accent", d.domain)).join(theme.fg("dim", ", "));
			parts.push(`${theme.fg("customMessageLabel", "📌 pinned")} ${pinned_list}`);
		}

		if (auto.length > 0) {
			const auto_list = auto.map((d) => theme.fg("accent", d.domain)).join(theme.fg("dim", ", "));
			parts.push(`${theme.fg("customMessageLabel", "🧠 expertise")} ${auto_list}`);
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
		description: "Manage domain expertise — list, chat, reflect, log, and init",

		getArgumentCompletions: (prefix: string) => {
			const sub_commands = ["chat", "reflect", "list", "log", "init"];
			const filtered = sub_commands.filter((c) => c.startsWith(prefix));
			if (filtered.length > 0) {
				return filtered.map((c) => ({
					value: c,
					label: c,
					description:
						c === "chat"
							? "Select experts to pin for this conversation"
							: c === "reflect"
								? "Reflect on conversation and update expertise"
								: c === "log"
									? "Show reflection history across domains"
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

			// /expert log [domain] [--limit N]
			if (trimmed === "log" || trimmed.startsWith("log ")) {
				const log_args = parse_log_args(trimmed);
				if (log_args.error) {
					ctx.ui.notify(log_args.error, "warning");
					return;
				}

				const { entries, skipped_entries } = await read_reflection_log(expertise_dir, {
					domain: log_args.domain,
					limit: log_args.limit,
				});

				if (entries.length === 0) {
					const target = log_args.domain ? ` for '${log_args.domain}'` : "";
					ctx.ui.notify(`No reflection log entries found${target}.`, "info");
					return;
				}

				const lines = entries.map((entry) => {
					const summary = entry.summary.replace(/\s+/g, " ").trim();
					return `- ${entry.date} · ${entry.domain} · ${summary} (model: ${entry.model})`;
				});

				const heading = log_args.domain
					? `Reflection log (${entries.length}) for '${log_args.domain}':`
					: `Reflection log (${entries.length}):`;
				const warning =
					skipped_entries > 0
						? `\n⚠ Skipped ${skipped_entries} malformed log entr${skipped_entries === 1 ? "y" : "ies"}.`
						: "";

				ctx.ui.notify(`${heading}\n${lines.join("\n")}${warning}`, skipped_entries > 0 ? "warning" : "info");
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
								return ["", theme.fg("dim", "  ←/→ toggle • ↑/↓ navigate • / search • esc confirm")];
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

				ctx.ui.setStatus(
					"expert",
					domain_arg ? `🧠 Reflecting on ${domain_arg}...` : "🧠 Router: identifying affected domains...",
				);

				try {
					const settings = await read_settings(expertise_dir);
					const session_file = ctx.sessionManager.getSessionFile() ?? "unknown";
					const branch_messages = ctx.sessionManager
						.getBranch()
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
				'Usage: /expert [list | chat [clear] | reflect <domain> | log [domain] [--limit N] | init <domain> <scope_path> [--description "..."]]',
				"info",
			);
		},
	});
}

interface ParsedLogArgs {
	domain?: string;
	limit: number;
	error?: string;
}

function parse_log_args(input: string): ParsedLogArgs {
	const tokens = tokenize_command_args(input);
	if (tokens.length === 0 || tokens[0] !== "log") {
		return { limit: DEFAULT_REFLECTION_LOG_LIMIT, error: "Usage: /expert log [domain] [--limit N]" };
	}

	let domain: string | undefined;
	let limit = DEFAULT_REFLECTION_LOG_LIMIT;

	for (let i = 1; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === "--limit") {
			const value = tokens[i + 1];
			if (!value || !/^\d+$/.test(value)) {
				return { limit, error: "Invalid --limit value. Usage: /expert log [domain] [--limit N]" };
			}
			limit = clamp_limit(Number.parseInt(value, 10));
			i++;
			continue;
		}

		if (token.startsWith("--")) {
			return { limit, error: `Unknown option '${token}'.` };
		}

		if (domain) {
			return { limit, error: "Only one domain is allowed. Usage: /expert log [domain] [--limit N]" };
		}
		domain = token;
	}

	return {
		domain,
		limit,
	};
}

interface ParsedInitArgs {
	domain: string;
	scope_path: string;
	description?: string;
	error?: string;
}

function parse_init_args(input: string): ParsedInitArgs {
	const tokens = tokenize_command_args(input);
	if (tokens.length < 3 || tokens[0] !== "init") {
		return {
			domain: "",
			scope_path: "",
			error: 'Usage: /expert init <domain> <scope_path> [--description "..."]',
		};
	}

	const domain = tokens[1] ?? "";
	const scope_path = tokens[2] ?? "";

	let description: string | undefined;
	for (let i = 3; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === "--description") {
			const value = tokens[i + 1];
			if (!value) {
				return {
					domain,
					scope_path,
					error: "Missing value for --description",
				};
			}
			description = value.trim();
			i++;
			continue;
		}

		if (token.startsWith("--")) {
			return {
				domain,
				scope_path,
				error: `Unknown option '${token}'.`,
			};
		}

		return {
			domain,
			scope_path,
			error: 'Unexpected arguments. Usage: /expert init <domain> <scope_path> [--description "..."]',
		};
	}

	return {
		domain,
		scope_path,
		description: description && description.length > 0 ? description : undefined,
	};
}

function tokenize_command_args(input: string): string[] {
	const tokens: string[] = [];
	const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;

	for (const match of input.matchAll(pattern)) {
		const quoted_double = match[1];
		const quoted_single = match[2];
		const raw = match[3];
		tokens.push(quoted_double ?? quoted_single ?? raw);
	}

	return tokens;
}

function clamp_limit(value: number): number {
	return Math.max(1, Math.min(MAX_REFLECTION_LOG_LIMIT, Math.floor(value)));
}
