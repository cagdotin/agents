import { existsSync } from "node:fs";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import {
	append_expand_hint,
	render_todo_detail,
	render_todo_list,
	serialize_todo_for_agent,
	serialize_todo_list_for_agent,
} from "./formatting.js";
import {
	clear_assignment_if_closed,
	format_todo_id,
	normalize_todo_id,
	split_todos_by_assignment,
	validate_todo_id,
} from "./helpers.js";
import {
	append_todo_body,
	claim_todo_assignment,
	delete_todo,
	ensure_todo_exists,
	ensure_todos_dir,
	generate_todo_id,
	get_todo_path,
	get_todos_dir,
	list_todos,
	release_todo_assignment,
	with_todo_lock,
	write_todo_file,
} from "./storage.js";
import type { TodoAction, TodoRecord, TodoToolDetails } from "./types.js";
import { TodoParams } from "./types.js";

export function create_todo_tool(todos_dir_label: string) {
	return {
		name: "todo",
		label: "Todo",
		description:
			`Manage file-based todos in ${todos_dir_label} (list, list-all, get, create, update, append, delete, claim, release). ` +
			"Title is the short summary; body is long-form markdown notes (update replaces, append adds). " +
			"Todo ids are shown as TODO-<hex>; id parameters accept TODO-<hex> or the raw hex filename. " +
			"Claim tasks before working on them to avoid conflicts, and close them when complete.",
		parameters: TodoParams,

		async execute(
			_tool_call_id: string,
			params: any,
			_signal: AbortSignal | undefined,
			_on_update: any,
			ctx: any,
		): Promise<any> {
			const todos_dir = get_todos_dir(ctx.cwd);
			const action: TodoAction = params.action;

			switch (action) {
				case "list": {
					const todos = await list_todos(todos_dir);
					const { assigned_todos, open_todos } = split_todos_by_assignment(todos);
					const listed_todos = [...assigned_todos, ...open_todos];
					const current_session_id = ctx.sessionManager.getSessionId();
					return {
						content: [{ type: "text", text: serialize_todo_list_for_agent(listed_todos) }],
						details: { action: "list", todos: listed_todos, current_session_id },
					};
				}

				case "list-all": {
					const todos = await list_todos(todos_dir);
					const current_session_id = ctx.sessionManager.getSessionId();
					return {
						content: [{ type: "text", text: serialize_todo_list_for_agent(todos) }],
						details: { action: "list-all", todos, current_session_id },
					};
				}

				case "get": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "get", error: "id required" },
						};
					}
					const validated = validate_todo_id(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "get", error: validated.error },
						};
					}
					const normalized_id = validated.id;
					const display_id = format_todo_id(normalized_id);
					const file_path = get_todo_path(todos_dir, normalized_id);
					const todo = await ensure_todo_exists(file_path, normalized_id);
					if (!todo) {
						return {
							content: [{ type: "text", text: `Todo ${display_id} not found` }],
							details: { action: "get", error: "not found" },
						};
					}
					return {
						content: [{ type: "text", text: serialize_todo_for_agent(todo) }],
						details: { action: "get", todo },
					};
				}

				case "create": {
					if (!params.title) {
						return {
							content: [{ type: "text", text: "Error: title required" }],
							details: { action: "create", error: "title required" },
						};
					}
					await ensure_todos_dir(todos_dir);
					const id = await generate_todo_id(todos_dir);
					const file_path = get_todo_path(todos_dir, id);
					const todo: TodoRecord = {
						id,
						title: params.title,
						tags: params.tags ?? [],
						status: params.status ?? "open",
						created_at: new Date().toISOString(),
						body: params.body ?? "",
					};

					const result = await with_todo_lock(todos_dir, id, ctx, async () => {
						await write_todo_file(file_path, todo);
						return todo;
					});

					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "create", error: result.error },
						};
					}

					return {
						content: [{ type: "text", text: serialize_todo_for_agent(todo) }],
						details: { action: "create", todo },
					};
				}

				case "update": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "update", error: "id required" },
						};
					}
					const validated = validate_todo_id(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "update", error: validated.error },
						};
					}
					const normalized_id = validated.id;
					const display_id = format_todo_id(normalized_id);
					const file_path = get_todo_path(todos_dir, normalized_id);
					if (!existsSync(file_path)) {
						return {
							content: [{ type: "text", text: `Todo ${display_id} not found` }],
							details: { action: "update", error: "not found" },
						};
					}
					const result = await with_todo_lock(todos_dir, normalized_id, ctx, async () => {
						const existing = await ensure_todo_exists(file_path, normalized_id);
						if (!existing) return { error: `Todo ${display_id} not found` } as const;

						existing.id = normalized_id;
						if (params.title !== undefined) existing.title = params.title;
						if (params.status !== undefined) existing.status = params.status;
						if (params.tags !== undefined) existing.tags = params.tags;
						if (params.body !== undefined) existing.body = params.body;
						if (!existing.created_at) existing.created_at = new Date().toISOString();
						clear_assignment_if_closed(existing);

						await write_todo_file(file_path, existing);
						return existing;
					});

					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "update", error: result.error },
						};
					}

					const updated_todo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serialize_todo_for_agent(updated_todo) }],
						details: { action: "update", todo: updated_todo },
					};
				}

				case "append": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "append", error: "id required" },
						};
					}
					const validated = validate_todo_id(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "append", error: validated.error },
						};
					}
					const normalized_id = validated.id;
					const display_id = format_todo_id(normalized_id);
					const file_path = get_todo_path(todos_dir, normalized_id);
					if (!existsSync(file_path)) {
						return {
							content: [{ type: "text", text: `Todo ${display_id} not found` }],
							details: { action: "append", error: "not found" },
						};
					}
					const result = await with_todo_lock(todos_dir, normalized_id, ctx, async () => {
						const existing = await ensure_todo_exists(file_path, normalized_id);
						if (!existing) return { error: `Todo ${display_id} not found` } as const;
						if (!params.body || !params.body.trim()) {
							return existing;
						}
						const updated = await append_todo_body(file_path, existing, params.body);
						return updated;
					});

					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "append", error: result.error },
						};
					}

					const updated_todo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serialize_todo_for_agent(updated_todo) }],
						details: { action: "append", todo: updated_todo },
					};
				}

				case "claim": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "claim", error: "id required" },
						};
					}
					const result = await claim_todo_assignment(todos_dir, params.id, ctx, Boolean(params.force));
					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "claim", error: result.error },
						};
					}
					const updated_todo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serialize_todo_for_agent(updated_todo) }],
						details: { action: "claim", todo: updated_todo },
					};
				}

				case "release": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "release", error: "id required" },
						};
					}
					const result = await release_todo_assignment(todos_dir, params.id, ctx, Boolean(params.force));
					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "release", error: result.error },
						};
					}
					const updated_todo = result as TodoRecord;
					return {
						content: [{ type: "text", text: serialize_todo_for_agent(updated_todo) }],
						details: { action: "release", todo: updated_todo },
					};
				}

				case "delete": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required" }],
							details: { action: "delete", error: "id required" },
						};
					}
					const validated = validate_todo_id(params.id);
					if ("error" in validated) {
						return {
							content: [{ type: "text", text: validated.error }],
							details: { action: "delete", error: validated.error },
						};
					}
					const result = await delete_todo(todos_dir, validated.id, ctx);
					if (typeof result === "object" && "error" in result) {
						return {
							content: [{ type: "text", text: result.error }],
							details: { action: "delete", error: result.error },
						};
					}
					return {
						content: [{ type: "text", text: serialize_todo_for_agent(result as TodoRecord) }],
						details: { action: "delete", todo: result as TodoRecord },
					};
				}
			}
		},

		renderCall(args: any, theme: Theme) {
			const action = typeof args.action === "string" ? args.action : "";
			const id = typeof args.id === "string" ? args.id : "";
			const normalized_id = id ? normalize_todo_id(id) : "";
			const title = typeof args.title === "string" ? args.title : "";
			let text = theme.fg("toolTitle", theme.bold("todo ")) + theme.fg("muted", action);
			if (normalized_id) {
				text += ` ${theme.fg("accent", format_todo_id(normalized_id))}`;
			}
			if (title) {
				text += ` ${theme.fg("dim", `"${title}"`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result: any, { expanded, isPartial }: any, theme: Theme) {
			const details = result.details as TodoToolDetails | undefined;
			if (isPartial) {
				return new Text(theme.fg("warning", "Processing..."), 0, 0);
			}
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			if (details.action === "list" || details.action === "list-all") {
				let text = render_todo_list(theme, details.todos, expanded, details.current_session_id);
				if (!expanded) {
					const { closed_todos } = split_todos_by_assignment(details.todos);
					if (closed_todos.length) {
						text = append_expand_hint(theme, text);
					}
				}
				return new Text(text, 0, 0);
			}

			if (!("todo" in details) || !details.todo) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			let text = render_todo_detail(theme, (details as any).todo, expanded);
			const detail_action = details.action;
			const action_label =
				detail_action === "create"
					? "Created"
					: detail_action === "update"
						? "Updated"
						: detail_action === "append"
							? "Appended to"
							: detail_action === "delete"
								? "Deleted"
								: detail_action === "claim"
									? "Claimed"
									: detail_action === "release"
										? "Released"
										: null;
			if (action_label) {
				const lines = text.split("\n");
				lines[0] = theme.fg("success", "✓ ") + theme.fg("muted", `${action_label} `) + lines[0];
				text = lines.join("\n");
			}
			if (!expanded) {
				text = append_expand_hint(theme, text);
			}
			return new Text(text, 0, 0);
		},
	};
}
