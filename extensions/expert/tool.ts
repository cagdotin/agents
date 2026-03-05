import type { Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { CONTENT_PRINCIPLES } from "./constants.js";
import { scan_scope_paths, validate_domain_name } from "./helpers.js";
import { run_reflection_pipeline } from "./reflection.js";
import {
	build_skeleton_yaml,
	delete_expertise,
	get_expertise_dir,
	list_domains,
	read_expertise,
	read_settings,
	write_expertise,
} from "./storage.js";
import type { ExpertiseAction, ExpertiseToolDetails } from "./types.js";
import { ExpertiseParams } from "./types.js";

export function create_expertise_tool(dir_label: string) {
	return {
		name: "expertise",
		label: "Expertise",
		description:
			`Manage domain expertise files in ${dir_label} — the agent's persistent mental model of specific areas of the codebase. ` +
			"Actions: list (show all domains), get (read a domain's expertise), init (bootstrap new domain from scope paths), " +
			"update (replace full YAML content), reflect (extract insights from current conversation and update — domain is optional, " +
			"omit to auto-detect affected domains via router), delete (remove domain). " +
			"After completing work that changes code in a domain's scope, use 'reflect' to update the expertise with learnings from the conversation.\n\n" +
			CONTENT_PRINCIPLES,
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
						.map(
							(d) =>
								`- **${d.domain}**: ${d.description || "(no description)"} (last synced: ${d.last_synced || "never"})`,
						)
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
					const file_listing =
						file_list.length > 0 ? file_list.map((f) => `  ${f}`).join("\n") : "  (no files found in scope paths)";

					const record = await read_expertise(expertise_dir, params.domain);

					return {
						content: [
							{
								type: "text",
								text:
									`Domain '${params.domain}' initialized.\n\nFiles in scope:\n${file_listing}\n\n` +
									"Now read the key files to understand the domain, then use 'update' to save your expertise.\n\n" +
									"CRITICAL — write a SHORT expertise file (aim for 30-60 lines of YAML). " +
									"Only include things that pass the 10-second rule: if a developer could figure it out " +
									"by reading the code in 10 seconds, LEAVE IT OUT.\n\n" +
									"Focus on:\n" +
									"- overview: 2-3 sentences of orientation, not a file listing\n" +
									"- design_decisions: WHY things are the way they are (most valuable section)\n" +
									"- gotchas: things that actually burn people\n" +
									"- references: 'for X see path/to/file' pointers\n\n" +
									"Do NOT include: file listings, function names, implementation details visible from the code, " +
									"patterns you can copy from existing files, anything that reads like documentation.\n\n" +
									"If you find yourself needing many gotchas or explanations, ask WHY — " +
									"it may signal poor naming, missing docs, or a domain that's too broad. " +
									"Add a 'codebase_concerns' section to flag these rather than just documenting around them.",
							},
						],
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

					// Count lines as a quality signal
					const line_count = params.content.split("\n").length;
					let size_note = "";
					if (line_count > 80) {
						size_note =
							` ⚠️ ${line_count} lines — this is unusually long. ` +
							"First, apply the 10-second rule and remove anything obvious from the code. " +
							"If it's still long, diagnose the root cause: is the domain scope too broad (split it)? " +
							"Is the code missing docs or using poor naming (suggest improvements)? " +
							"Are there too many implicit conventions that should be explicit in the code? " +
							"Add a 'codebase_concerns' section to flag structural issues rather than just documenting the mess.";
					}

					return {
						content: [{ type: "text", text: `Domain '${params.domain}' expertise updated.${size_note}` }],
						details: { action: "update", domain: params.domain },
					};
				}

				case "reflect": {
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
						params.domain || undefined,
					);

					if (pipeline.results.length === 0) {
						const msg = pipeline.router_skipped
							? "No results from reflection."
							: "Router found no domains affected by this conversation.";
						return {
							content: [{ type: "text", text: msg }],
							details: { action: "reflect", results: [], router_skipped: pipeline.router_skipped },
						};
					}

					const successes = pipeline.results.filter((r) => !r.error);
					const failures = pipeline.results.filter((r) => r.error);

					const parts: string[] = [];
					if (successes.length > 0) {
						parts.push("**Updated:**");
						for (const r of successes) {
							parts.push(`- **${r.domain}**: ${r.summary}`);
						}
					}
					if (failures.length > 0) {
						parts.push("\n**Failed:**");
						for (const r of failures) {
							parts.push(`- **${r.domain}**: ${r.error}`);
						}
					}

					const has_errors = failures.length > 0 && successes.length === 0;
					if (has_errors) {
						return {
							content: [{ type: "text", text: parts.join("\n") }],
							details: {
								action: "reflect",
								results: pipeline.results,
								router_skipped: pipeline.router_skipped,
								error: failures[0].error,
							},
						};
					}

					return {
						content: [{ type: "text", text: parts.join("\n") }],
						details: {
							action: "reflect",
							results: pipeline.results,
							router_skipped: pipeline.router_skipped,
						},
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
				text += ` ${theme.fg("accent", domain)}`;
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
						const synced = d.last_synced ? theme.fg("dim", ` (${d.last_synced})`) : "";
						return `  ${theme.fg("accent", d.domain)} ${theme.fg("muted", d.description)}${synced}`;
					});
					const header = theme.fg("success", "✓ ") + theme.fg("muted", `${details.domains.length} domain(s)`);
					const text = expanded ? [header, ...lines].join("\n") : header;
					return new Text(text, 0, 0);
				}

				case "get": {
					const header = theme.fg("success", "✓ ") + theme.fg("muted", "Read ") + theme.fg("accent", details.domain);
					if (!expanded) return new Text(header, 0, 0);
					const preview = details.expertise.raw.split("\n").slice(0, 20).join("\n");
					return new Text(`${header}\n${theme.fg("dim", preview)}`, 0, 0);
				}

				case "init": {
					return new Text(
						theme.fg("success", "✓ ") + theme.fg("muted", "Initialized ") + theme.fg("accent", details.domain),
						0,
						0,
					);
				}

				case "update": {
					return new Text(
						theme.fg("success", "✓ ") + theme.fg("muted", "Updated ") + theme.fg("accent", details.domain),
						0,
						0,
					);
				}

				case "reflect": {
					const successes = details.results.filter((r: any) => !r.error);
					const failures = details.results.filter((r: any) => r.error);

					if (successes.length === 0 && failures.length === 0) {
						return new Text(theme.fg("dim", "No domains affected"), 0, 0);
					}

					const domain_names = successes.map((r: any) => r.domain).join(", ");
					const header =
						theme.fg("success", "🧠 ") +
						theme.fg("muted", "Reflected on ") +
						theme.fg("accent", domain_names || "(none)");

					if (failures.length > 0) {
						const fail_note = theme.fg("error", ` (${failures.length} failed)`);
						if (!expanded) return new Text(header + fail_note, 0, 0);
					}

					if (!expanded) return new Text(header, 0, 0);

					const detail_lines = successes
						.map((r: any) => `  ${theme.fg("accent", r.domain)}: ${theme.fg("dim", r.summary)}`)
						.concat(failures.map((r: any) => `  ${theme.fg("error", r.domain)}: ${theme.fg("dim", r.error)}`));
					return new Text(`${header}\n${detail_lines.join("\n")}`, 0, 0);
				}

				case "delete": {
					return new Text(
						theme.fg("success", "✓ ") + theme.fg("muted", "Deleted ") + theme.fg("accent", details.domain),
						0,
						0,
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
