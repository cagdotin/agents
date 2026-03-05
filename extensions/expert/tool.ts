import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { ExpertiseAction, ExpertiseToolDetails } from "./types.js";
import { ExpertiseParams } from "./types.js";
import { validate_domain_name, scan_scope_paths } from "./helpers.js";
import {
	get_expertise_dir,
	read_expertise,
	write_expertise,
	delete_expertise,
	list_domains,
	build_skeleton_yaml,
	read_settings,
} from "./storage.js";
import { run_reflection } from "./reflection.js";

export function create_expertise_tool(pi: ExtensionAPI, dir_label: string) {
	return {
		name: "expertise",
		label: "Expertise",
		description:
			`Manage domain expertise files in ${dir_label} — the agent's persistent mental model of specific areas of the codebase. ` +
			"Actions: list (show all domains), get (read a domain's expertise), init (bootstrap new domain from scope paths), " +
			"update (replace full YAML content), reflect (extract insights from current conversation and update), delete (remove domain). " +
			"After completing work that changes code in a domain's scope, use 'reflect' to update the expertise with learnings from the conversation.",
		parameters: ExpertiseParams,

		async execute(
			_tool_call_id: string,
			params: any,
			_signal: AbortSignal | undefined,
			_on_update: any,
			ctx: any,
		): Promise<any> {
			const expertise_dir = get_expertise_dir(ctx.cwd);
			const action: ExpertiseAction = params.action;

			switch (action) {
				case "list": {
					const domains = await list_domains(expertise_dir);
					if (domains.length === 0) {
						return {
							content: [{ type: "text", text: "No expertise domains found. Use 'init' to create one." }],
							details: { action: "list", domains: [] },
						};
					}
					const summary = domains
						.map((d) => `- **${d.domain}**: ${d.description || "(no description)"} (last synced: ${d.last_synced || "never"})`)
						.join("\n");
					return {
						content: [{ type: "text", text: summary }],
						details: { action: "list", domains },
					};
				}

				case "get": {
					if (!params.domain) {
						return error_result("get", "domain is required");
					}
					const record = await read_expertise(expertise_dir, params.domain);
					if (!record) {
						return error_result("get", `Domain '${params.domain}' not found`);
					}
					return {
						content: [{ type: "text", text: record.raw }],
						details: { action: "get", domain: params.domain, expertise: record },
					};
				}

				case "init": {
					if (!params.domain) {
						return error_result("init", "domain is required");
					}
					const validation = validate_domain_name(params.domain);
					if (!validation.valid) {
						return error_result("init", (validation as { valid: false; error: string }).error);
					}
					if (!params.description) {
						return error_result("init", "description is required for init");
					}
					const scope_paths = params.scope_paths ?? [];
					if (scope_paths.length === 0) {
						return error_result("init", "scope_paths is required for init (at least one path)");
					}

					// Check if domain already exists
					const existing = await read_expertise(expertise_dir, params.domain);
					if (existing) {
						return error_result("init", `Domain '${params.domain}' already exists. Use 'update' to modify it.`);
					}

					// Build skeleton
					const yaml = build_skeleton_yaml(params.domain, params.description, scope_paths);
					await write_expertise(expertise_dir, params.domain, yaml);

					// Scan scope paths to give the agent a file listing
					const file_list = await scan_scope_paths(scope_paths, ctx.cwd);
					const file_listing = file_list.length > 0
						? file_list.map((f) => `  ${f}`).join("\n")
						: "  (no files found in scope paths)";

					const record = await read_expertise(expertise_dir, params.domain);

					return {
						content: [{
							type: "text",
							text: `Domain '${params.domain}' initialized.\n\nFiles in scope:\n${file_listing}\n\n` +
								"Now read the key files to understand the domain, then use 'update' to save your expertise.\n\n" +
								"IMPORTANT: Focus on insights that aren't obvious from reading the code:\n" +
								"- overview: brief high-level orientation (not a file listing)\n" +
								"- patterns: conventions and architectural patterns\n" +
								"- gotchas: non-obvious traps and quirks\n" +
								"- design_decisions: WHY things are the way they are\n" +
								"- references: 'for X see path/to/file' pointers\n" +
								"Do NOT list files, functions, or exports — the agent can look those up with its tools.",
						}],
						details: {
							action: "init",
							domain: params.domain,
							expertise: record!,
							file_listing,
						},
					};
				}

				case "update": {
					if (!params.domain) {
						return error_result("update", "domain is required");
					}
					if (!params.content) {
						return error_result("update", "content (YAML string) is required for update");
					}

					// Verify domain exists
					const existing = await read_expertise(expertise_dir, params.domain);
					if (!existing) {
						return error_result("update", `Domain '${params.domain}' not found. Use 'init' to create it.`);
					}

					await write_expertise(expertise_dir, params.domain, params.content);
					return {
						content: [{ type: "text", text: `Domain '${params.domain}' expertise updated.` }],
						details: { action: "update", domain: params.domain },
					};
				}

				case "reflect": {
					if (!params.domain) {
						return error_result("reflect", "domain is required");
					}

					const settings = await read_settings(expertise_dir);
					const session_file = ctx.sessionManager.getSessionFile() ?? "unknown";
					const branch_messages = ctx.sessionManager.getBranch()
						.filter((e: any) => e.type === "message")
						.map((e: any) => e.message);

					const result = await run_reflection(
						pi,
						params.domain,
						branch_messages,
						settings,
						ctx.cwd,
						session_file,
					);

					if ("error" in result) {
						return error_result("reflect", result.error);
					}

					return {
						content: [{
							type: "text",
							text: `Expertise for '${params.domain}' updated via reflection.\n\n**What changed:**\n${result.summary}`,
						}],
						details: { action: "reflect", domain: params.domain, summary: result.summary },
					};
				}

				case "delete": {
					if (!params.domain) {
						return error_result("delete", "domain is required");
					}
					const deleted = await delete_expertise(expertise_dir, params.domain);
					if (!deleted) {
						return error_result("delete", `Domain '${params.domain}' not found`);
					}
					return {
						content: [{ type: "text", text: `Domain '${params.domain}' deleted.` }],
						details: { action: "delete", domain: params.domain },
					};
				}
			}
		},

		renderCall(args: any, theme: Theme) {
			const action = typeof args.action === "string" ? args.action : "";
			const domain = typeof args.domain === "string" ? args.domain : "";

			let text = theme.fg("toolTitle", theme.bold("expertise "));
			text += theme.fg("muted", action);
			if (domain) {
				text += " " + theme.fg("accent", domain);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result: any, { expanded, isPartial }: any, theme: Theme) {
			const details = result.details as ExpertiseToolDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "Processing..."), 0, 0);
			}

			if (!details) {
				const text_block = result.content?.[0];
				return new Text(text_block?.type === "text" ? text_block.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			switch (details.action) {
				case "list": {
					if (details.domains.length === 0) {
						return new Text(theme.fg("dim", "No expertise domains"), 0, 0);
					}
					const lines = details.domains.map((d) => {
						const synced = d.last_synced
							? theme.fg("dim", ` (${d.last_synced})`)
							: "";
						return `  ${theme.fg("accent", d.domain)} ${theme.fg("muted", d.description)}${synced}`;
					});
					const header = theme.fg("success", "✓ ") +
						theme.fg("muted", `${details.domains.length} domain(s)`);
					const text = expanded
						? [header, ...lines].join("\n")
						: header;
					return new Text(text, 0, 0);
				}

				case "get": {
					const header = theme.fg("success", "✓ ") +
						theme.fg("muted", "Read ") +
						theme.fg("accent", details.domain);
					if (!expanded) return new Text(header, 0, 0);
					const preview = details.expertise.raw.split("\n").slice(0, 20).join("\n");
					return new Text(`${header}\n${theme.fg("dim", preview)}`, 0, 0);
				}

				case "init": {
					return new Text(
						theme.fg("success", "✓ ") +
						theme.fg("muted", "Initialized ") +
						theme.fg("accent", details.domain),
						0, 0,
					);
				}

				case "update": {
					return new Text(
						theme.fg("success", "✓ ") +
						theme.fg("muted", "Updated ") +
						theme.fg("accent", details.domain),
						0, 0,
					);
				}

				case "reflect": {
					const header = theme.fg("success", "🧠 ") +
						theme.fg("muted", "Reflected on ") +
						theme.fg("accent", details.domain);
					if (!expanded) return new Text(header, 0, 0);
					return new Text(`${header}\n${theme.fg("dim", details.summary)}`, 0, 0);
				}

				case "delete": {
					return new Text(
						theme.fg("success", "✓ ") +
						theme.fg("muted", "Deleted ") +
						theme.fg("accent", details.domain),
						0, 0,
					);
				}

				default:
					return new Text("", 0, 0);
			}
		},
	};
}

function error_result(action: string, error: string) {
	return {
		content: [{ type: "text", text: `Error: ${error}` }],
		details: { action, error },
	};
}
