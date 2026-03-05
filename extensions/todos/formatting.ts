import { keyHint, type Theme } from "@mariozechner/pi-coding-agent";
import {
	format_todo_id,
	get_todo_status,
	get_todo_title,
	is_todo_closed,
	split_todos_by_assignment,
} from "./helpers.js";
import type { TodoFrontMatter, TodoRecord } from "./types.js";

// ---------------------------------------------------------------------------
// Plain text formatting (for LLM / non-UI output)
// ---------------------------------------------------------------------------

export function format_assignment_suffix(todo: TodoFrontMatter): string {
	return todo.assigned_to_session ? ` (assigned: ${todo.assigned_to_session})` : "";
}

export function format_todo_heading(todo: TodoFrontMatter): string {
	const tag_text = todo.tags.length ? ` [${todo.tags.join(", ")}]` : "";
	return `${format_todo_id(todo.id)} ${get_todo_title(todo)}${tag_text}${format_assignment_suffix(todo)}`;
}

export function format_todo_list(todos: TodoFrontMatter[]): string {
	if (!todos.length) return "No todos.";

	const { assigned_todos, open_todos, closed_todos } = split_todos_by_assignment(todos);
	const lines: string[] = [];

	const push_section = (label: string, section_todos: TodoFrontMatter[]) => {
		lines.push(`${label} (${section_todos.length}):`);
		if (!section_todos.length) {
			lines.push("  none");
			return;
		}
		for (const todo of section_todos) {
			lines.push(`  ${format_todo_heading(todo)}`);
		}
	};

	push_section("Assigned todos", assigned_todos);
	push_section("Open todos", open_todos);
	push_section("Closed todos", closed_todos);
	return lines.join("\n");
}

export function serialize_todo_for_agent(todo: TodoRecord): string {
	const payload = { ...todo, id: format_todo_id(todo.id) };
	return JSON.stringify(payload, null, 2);
}

export function serialize_todo_list_for_agent(todos: TodoFrontMatter[]): string {
	const { assigned_todos, open_todos, closed_todos } = split_todos_by_assignment(todos);
	const map_todo = (todo: TodoFrontMatter) => ({ ...todo, id: format_todo_id(todo.id) });
	return JSON.stringify(
		{
			assigned: assigned_todos.map(map_todo),
			open: open_todos.map(map_todo),
			closed: closed_todos.map(map_todo),
		},
		null,
		2,
	);
}

// ---------------------------------------------------------------------------
// Themed rendering (for TUI)
// ---------------------------------------------------------------------------

export function render_assignment_suffix(theme: Theme, todo: TodoFrontMatter, current_session_id?: string): string {
	if (!todo.assigned_to_session) return "";
	const is_current = todo.assigned_to_session === current_session_id;
	const color = is_current ? "success" : "dim";
	const suffix = is_current ? ", current" : "";
	return theme.fg(color, ` (assigned: ${todo.assigned_to_session}${suffix})`);
}

export function render_todo_heading(theme: Theme, todo: TodoFrontMatter, current_session_id?: string): string {
	const closed = is_todo_closed(get_todo_status(todo));
	const title_color = closed ? "dim" : "text";
	const tag_text = todo.tags.length ? theme.fg("dim", ` [${todo.tags.join(", ")}]`) : "";
	const assignment_text = render_assignment_suffix(theme, todo, current_session_id);
	return (
		theme.fg("accent", format_todo_id(todo.id)) +
		" " +
		theme.fg(title_color, get_todo_title(todo)) +
		tag_text +
		assignment_text
	);
}

export function render_todo_list(
	theme: Theme,
	todos: TodoFrontMatter[],
	expanded: boolean,
	current_session_id?: string,
): string {
	if (!todos.length) return theme.fg("dim", "No todos");

	const { assigned_todos, open_todos, closed_todos } = split_todos_by_assignment(todos);
	const lines: string[] = [];

	const push_section = (label: string, section_todos: TodoFrontMatter[]) => {
		lines.push(theme.fg("muted", `${label} (${section_todos.length})`));
		if (!section_todos.length) {
			lines.push(theme.fg("dim", "  none"));
			return;
		}
		const max_items = expanded ? section_todos.length : Math.min(section_todos.length, 3);
		for (let i = 0; i < max_items; i++) {
			lines.push(`  ${render_todo_heading(theme, section_todos[i], current_session_id)}`);
		}
		if (!expanded && section_todos.length > max_items) {
			lines.push(theme.fg("dim", `  ... ${section_todos.length - max_items} more`));
		}
	};

	const sections: Array<{ label: string; todos: TodoFrontMatter[] }> = [
		{ label: "Assigned todos", todos: assigned_todos },
		{ label: "Open todos", todos: open_todos },
		{ label: "Closed todos", todos: closed_todos },
	];

	sections.forEach((section, index) => {
		if (index > 0) lines.push("");
		push_section(section.label, section.todos);
	});

	return lines.join("\n");
}

export function render_todo_detail(theme: Theme, todo: TodoRecord, expanded: boolean): string {
	const summary = render_todo_heading(theme, todo);
	if (!expanded) return summary;

	const tags = todo.tags.length ? todo.tags.join(", ") : "none";
	const created_at = todo.created_at || "unknown";
	const body_text = todo.body?.trim() ? todo.body.trim() : "No details yet.";
	const body_lines = body_text.split("\n");

	const lines = [
		summary,
		theme.fg("muted", `Status: ${get_todo_status(todo)}`),
		theme.fg("muted", `Tags: ${tags}`),
		theme.fg("muted", `Created: ${created_at}`),
		"",
		theme.fg("muted", "Body:"),
		...body_lines.map((line) => theme.fg("text", `  ${line}`)),
	];

	return lines.join("\n");
}

export function append_expand_hint(theme: Theme, text: string): string {
	return `${text}\n${theme.fg("dim", `(${keyHint("expandTools", "to expand")})`)}`;
}
