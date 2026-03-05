import path from "node:path";
import { copyToClipboard, type Theme } from "@mariozechner/pi-coding-agent";
import type { TUI } from "@mariozechner/pi-tui";
import { TodoActionMenuComponent } from "./components/todo-action-menu.js";
import { TodoDeleteConfirmComponent } from "./components/todo-delete-confirm.js";
import { TodoDetailOverlayComponent } from "./components/todo-detail-overlay.js";
import { TodoSelectorComponent } from "./components/todo-selector.js";
import { format_todo_list } from "./formatting.js";
import { build_refine_prompt, filter_todos, format_todo_id } from "./helpers.js";
import {
	delete_todo,
	ensure_todo_exists,
	get_todo_path,
	get_todos_dir,
	list_todos,
	list_todos_sync,
	release_todo_assignment,
	update_todo_status,
} from "./storage.js";
import type { TodoFrontMatter, TodoMenuAction, TodoOverlayAction, TodoRecord } from "./types.js";

export function create_todos_command() {
	return {
		description: "List todos from .pi/todos",

		getArgumentCompletions: (argument_prefix: string) => {
			const todos = list_todos_sync(get_todos_dir(process.cwd()));
			if (!todos.length) return null;
			const matches = filter_todos(todos, argument_prefix);
			if (!matches.length) return null;
			return matches.map((todo) => {
				const title = todo.title || "(untitled)";
				const tags = todo.tags.length ? ` • ${todo.tags.join(", ")}` : "";
				return {
					value: title,
					label: `${format_todo_id(todo.id)} ${title}`,
					description: `${todo.status || "open"}${tags}`,
				};
			});
		},

		handler: async (args: string | undefined, ctx: any) => {
			const todos_dir = get_todos_dir(ctx.cwd);
			const todos = await list_todos(todos_dir);
			const current_session_id = ctx.sessionManager.getSessionId();
			const search_term = (args ?? "").trim();

			if (!ctx.hasUI) {
				const text = format_todo_list(todos);
				console.log(text);
				return;
			}

			let next_prompt: string | null = null;
			let root_tui: TUI | null = null;

			await ctx.ui.custom((tui: TUI, theme: Theme, _kb: any, done: () => void) => {
				root_tui = tui;
				let selector: TodoSelectorComponent | null = null;
				let action_menu: TodoActionMenuComponent | null = null;
				let delete_confirm: TodoDeleteConfirmComponent | null = null;
				let active_component: {
					render: (width: number) => string[];
					invalidate: () => void;
					handleInput?: (data: string) => void;
					focused?: boolean;
				} | null = null;
				let wrapper_focused = false;

				const set_active_component = (
					component: {
						render: (width: number) => string[];
						invalidate: () => void;
						handleInput?: (data: string) => void;
						focused?: boolean;
					} | null,
				) => {
					if (active_component && "focused" in active_component) {
						active_component.focused = false;
					}
					active_component = component;
					if (active_component && "focused" in active_component) {
						active_component.focused = wrapper_focused;
					}
					tui.requestRender();
				};

				const copy_todo_path_to_clipboard = (todo_id: string) => {
					const file_path = get_todo_path(todos_dir, todo_id);
					const absolute_path = path.resolve(file_path);
					try {
						copyToClipboard(absolute_path);
						ctx.ui.notify(`Copied ${absolute_path} to clipboard`, "info");
					} catch (error: any) {
						const message = error instanceof Error ? error.message : String(error);
						ctx.ui.notify(message, "error");
					}
				};

				const copy_todo_text_to_clipboard = (record: TodoRecord) => {
					const title = record.title || "(untitled)";
					const body = record.body?.trim() || "";
					const text = body ? `# ${title}\n\n${body}` : `# ${title}`;
					try {
						copyToClipboard(text);
						ctx.ui.notify("Copied todo text to clipboard", "info");
					} catch (error: any) {
						const message = error instanceof Error ? error.message : String(error);
						ctx.ui.notify(message, "error");
					}
				};

				const resolve_todo_record = async (todo: TodoFrontMatter): Promise<TodoRecord | null> => {
					const file_path = get_todo_path(todos_dir, todo.id);
					const record = await ensure_todo_exists(file_path, todo.id);
					if (!record) {
						ctx.ui.notify(`Todo ${format_todo_id(todo.id)} not found`, "error");
						return null;
					}
					return record;
				};

				const open_todo_overlay = async (record: TodoRecord): Promise<TodoOverlayAction> => {
					const action = await ctx.ui.custom(
						(
							overlay_tui: TUI,
							overlay_theme: Theme,
							_overlay_kb: any,
							overlay_done: (action: TodoOverlayAction) => void,
						) => new TodoDetailOverlayComponent(overlay_tui, overlay_theme, record, overlay_done),
						{
							overlay: true,
							overlayOptions: { width: "80%", maxHeight: "80%", anchor: "center" },
						},
					);

					return action ?? "back";
				};

				const apply_todo_action = async (record: TodoRecord, action: TodoMenuAction): Promise<"stay" | "exit"> => {
					if (action === "refine") {
						const title = record.title || "(untitled)";
						next_prompt = build_refine_prompt(record.id, title);
						done();
						return "exit";
					}
					if (action === "work") {
						const title = record.title || "(untitled)";
						next_prompt = `work on todo ${format_todo_id(record.id)} "${title}"`;
						done();
						return "exit";
					}
					if (action === "view") {
						return "stay";
					}
					if (action === "copyPath") {
						copy_todo_path_to_clipboard(record.id);
						return "stay";
					}
					if (action === "copyText") {
						copy_todo_text_to_clipboard(record);
						return "stay";
					}

					if (action === "release") {
						const result = await release_todo_assignment(todos_dir, record.id, ctx, true);
						if ("error" in result) {
							ctx.ui.notify(result.error, "error");
							return "stay";
						}
						const updated_todos = await list_todos(todos_dir);
						selector?.set_todos(updated_todos);
						ctx.ui.notify(`Released todo ${format_todo_id(record.id)}`, "info");
						return "stay";
					}

					if (action === "delete") {
						const result = await delete_todo(todos_dir, record.id, ctx);
						if ("error" in result) {
							ctx.ui.notify(result.error, "error");
							return "stay";
						}
						const updated_todos = await list_todos(todos_dir);
						selector?.set_todos(updated_todos);
						ctx.ui.notify(`Deleted todo ${format_todo_id(record.id)}`, "info");
						return "stay";
					}

					const next_status = action === "close" ? "closed" : "open";
					const result = await update_todo_status(todos_dir, record.id, next_status, ctx);
					if ("error" in result) {
						ctx.ui.notify(result.error, "error");
						return "stay";
					}

					const updated_todos = await list_todos(todos_dir);
					selector?.set_todos(updated_todos);
					ctx.ui.notify(`${action === "close" ? "Closed" : "Reopened"} todo ${format_todo_id(record.id)}`, "info");
					return "stay";
				};

				const handle_action_selection = async (record: TodoRecord, action: TodoMenuAction) => {
					if (action === "view") {
						const overlay_action = await open_todo_overlay(record);
						if (overlay_action === "work") {
							await apply_todo_action(record, "work");
							return;
						}
						if (action_menu) {
							set_active_component(action_menu);
						}
						return;
					}

					if (action === "delete") {
						const message = `Delete todo ${format_todo_id(record.id)}? This cannot be undone.`;
						delete_confirm = new TodoDeleteConfirmComponent(theme, message, (confirmed) => {
							if (!confirmed) {
								set_active_component(action_menu);
								return;
							}
							void (async () => {
								await apply_todo_action(record, "delete");
								set_active_component(selector);
							})();
						});
						set_active_component(delete_confirm);
						return;
					}

					const result = await apply_todo_action(record, action);
					if (result === "stay") {
						set_active_component(selector);
					}
				};

				const show_action_menu = async (todo: TodoFrontMatter | TodoRecord) => {
					const record = "body" in todo ? (todo as TodoRecord) : await resolve_todo_record(todo);
					if (!record) return;
					action_menu = new TodoActionMenuComponent(
						theme,
						record,
						(action) => {
							void handle_action_selection(record, action);
						},
						() => {
							set_active_component(selector);
						},
					);
					set_active_component(action_menu);
				};

				const handle_select = async (todo: TodoFrontMatter) => {
					await show_action_menu(todo);
				};

				selector = new TodoSelectorComponent(
					tui,
					theme,
					todos,
					(todo) => {
						void handle_select(todo);
					},
					() => done(),
					search_term || undefined,
					current_session_id,
					(todo, action) => {
						const title = todo.title || "(untitled)";
						next_prompt =
							action === "refine"
								? build_refine_prompt(todo.id, title)
								: `work on todo ${format_todo_id(todo.id)} "${title}"`;
						done();
					},
				);

				set_active_component(selector);

				const root_component = {
					get focused() {
						return wrapper_focused;
					},
					set focused(value: boolean) {
						wrapper_focused = value;
						if (active_component && "focused" in active_component) {
							active_component.focused = value;
						}
					},
					render(width: number) {
						return active_component ? active_component.render(width) : [];
					},
					invalidate() {
						active_component?.invalidate();
					},
					handleInput(data: string) {
						active_component?.handleInput?.(data);
					},
				};

				return root_component;
			});

			if (next_prompt) {
				ctx.ui.setEditorText(next_prompt);
				root_tui?.requestRender();
			}
		},
	};
}
