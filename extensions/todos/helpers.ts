import { fuzzyMatch } from "@mariozechner/pi-tui";
import { TODO_ID_PATTERN, TODO_ID_PREFIX } from "./constants.js";
import type { TodoFrontMatter } from "./types.js";

export function format_todo_id(id: string): string {
	return `${TODO_ID_PREFIX}${id}`;
}

export function normalize_todo_id(id: string): string {
	let trimmed = id.trim();
	if (trimmed.startsWith("#")) {
		trimmed = trimmed.slice(1);
	}
	if (trimmed.toUpperCase().startsWith(TODO_ID_PREFIX)) {
		trimmed = trimmed.slice(TODO_ID_PREFIX.length);
	}
	return trimmed;
}

export function validate_todo_id(id: string): { id: string } | { error: string } {
	const normalized = normalize_todo_id(id);
	if (!normalized || !TODO_ID_PATTERN.test(normalized)) {
		return { error: "Invalid todo id. Expected TODO-<hex>." };
	}
	return { id: normalized.toLowerCase() };
}

export function display_todo_id(id: string): string {
	return format_todo_id(normalize_todo_id(id));
}

export function is_todo_closed(status: string): boolean {
	return ["closed", "done"].includes(status.toLowerCase());
}

export function get_todo_title(todo: TodoFrontMatter): string {
	return todo.title || "(untitled)";
}

export function get_todo_status(todo: TodoFrontMatter): string {
	return todo.status || "open";
}

export function clear_assignment_if_closed(todo: TodoFrontMatter): void {
	if (is_todo_closed(get_todo_status(todo))) {
		todo.assigned_to_session = undefined;
	}
}

export function sort_todos(todos: TodoFrontMatter[]): TodoFrontMatter[] {
	return [...todos].sort((a, b) => {
		const a_closed = is_todo_closed(a.status);
		const b_closed = is_todo_closed(b.status);
		if (a_closed !== b_closed) return a_closed ? 1 : -1;
		const a_assigned = !a_closed && Boolean(a.assigned_to_session);
		const b_assigned = !b_closed && Boolean(b.assigned_to_session);
		if (a_assigned !== b_assigned) return a_assigned ? -1 : 1;
		return (a.created_at || "").localeCompare(b.created_at || "");
	});
}

export function build_todo_search_text(todo: TodoFrontMatter): string {
	const tags = todo.tags.join(" ");
	const assignment = todo.assigned_to_session ? `assigned:${todo.assigned_to_session}` : "";
	return `${format_todo_id(todo.id)} ${todo.id} ${todo.title} ${tags} ${todo.status} ${assignment}`.trim();
}

export function filter_todos(todos: TodoFrontMatter[], query: string): TodoFrontMatter[] {
	const trimmed = query.trim();
	if (!trimmed) return todos;

	const tokens = trimmed
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);

	if (tokens.length === 0) return todos;

	const matches: Array<{ todo: TodoFrontMatter; score: number }> = [];
	for (const todo of todos) {
		const text = build_todo_search_text(todo);
		let total_score = 0;
		let matched = true;
		for (const token of tokens) {
			const result = fuzzyMatch(token, text);
			if (!result.matches) {
				matched = false;
				break;
			}
			total_score += result.score;
		}
		if (matched) {
			matches.push({ todo, score: total_score });
		}
	}

	return matches
		.sort((a, b) => {
			const a_closed = is_todo_closed(a.todo.status);
			const b_closed = is_todo_closed(b.todo.status);
			if (a_closed !== b_closed) return a_closed ? 1 : -1;
			const a_assigned = !a_closed && Boolean(a.todo.assigned_to_session);
			const b_assigned = !b_closed && Boolean(b.todo.assigned_to_session);
			if (a_assigned !== b_assigned) return a_assigned ? -1 : 1;
			return a.score - b.score;
		})
		.map((match) => match.todo);
}

export function split_todos_by_assignment(todos: TodoFrontMatter[]): {
	assigned_todos: TodoFrontMatter[];
	open_todos: TodoFrontMatter[];
	closed_todos: TodoFrontMatter[];
} {
	const assigned_todos: TodoFrontMatter[] = [];
	const open_todos: TodoFrontMatter[] = [];
	const closed_todos: TodoFrontMatter[] = [];
	for (const todo of todos) {
		if (is_todo_closed(get_todo_status(todo))) {
			closed_todos.push(todo);
			continue;
		}
		if (todo.assigned_to_session) {
			assigned_todos.push(todo);
		} else {
			open_todos.push(todo);
		}
	}
	return { assigned_todos, open_todos, closed_todos };
}

export function build_refine_prompt(todo_id: string, title: string): string {
	return (
		`let's refine task ${format_todo_id(todo_id)} "${title}": ` +
		"Ask me for the missing details needed to refine the todo together. Do not rewrite the todo yet and do not make assumptions. " +
		"Ask clear, concrete questions and wait for my answers before drafting any structured description.\n\n"
	);
}
