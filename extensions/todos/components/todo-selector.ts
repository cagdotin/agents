import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import {
	Container,
	type Focusable,
	getEditorKeybindings,
	Input,
	Key,
	matchesKey,
	Spacer,
	Text,
	type TUI,
} from "@mariozechner/pi-tui";
import { render_assignment_suffix } from "../formatting.js";
import { filter_todos, format_todo_id, is_todo_closed } from "../helpers.js";
import type { TodoFrontMatter } from "../types.js";

export class TodoSelectorComponent extends Container implements Focusable {
	private search_input: Input;
	private list_container: Container;
	private all_todos: TodoFrontMatter[];
	private filtered_todos: TodoFrontMatter[];
	private selected_index = 0;
	private on_select_callback: (todo: TodoFrontMatter) => void;
	private on_cancel_callback: () => void;
	private tui: TUI;
	private theme: Theme;
	private header_text: Text;
	private hint_text: Text;
	private current_session_id?: string;
	private on_quick_action?: (todo: TodoFrontMatter, action: "work" | "refine") => void;

	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.search_input.focused = value;
	}

	constructor(
		tui: TUI,
		theme: Theme,
		todos: TodoFrontMatter[],
		on_select: (todo: TodoFrontMatter) => void,
		on_cancel: () => void,
		initial_search_input?: string,
		current_session_id?: string,
		on_quick_action?: (todo: TodoFrontMatter, action: "work" | "refine") => void,
	) {
		super();
		this.tui = tui;
		this.theme = theme;
		this.current_session_id = current_session_id;
		this.all_todos = todos;
		this.filtered_todos = todos;
		this.on_select_callback = on_select;
		this.on_cancel_callback = on_cancel;
		this.on_quick_action = on_quick_action;

		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		this.addChild(new Spacer(1));

		this.header_text = new Text("", 1, 0);
		this.addChild(this.header_text);
		this.addChild(new Spacer(1));

		this.search_input = new Input();
		if (initial_search_input) {
			this.search_input.setValue(initial_search_input);
		}
		this.search_input.onSubmit = () => {
			const selected = this.filtered_todos[this.selected_index];
			if (selected) this.on_select_callback(selected);
		};
		this.addChild(this.search_input);

		this.addChild(new Spacer(1));
		this.list_container = new Container();
		this.addChild(this.list_container);

		this.addChild(new Spacer(1));
		this.hint_text = new Text("", 1, 0);
		this.addChild(this.hint_text);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

		this.update_header();
		this.update_hints();
		this.apply_filter(this.search_input.getValue());
	}

	set_todos(todos: TodoFrontMatter[]): void {
		this.all_todos = todos;
		this.update_header();
		this.apply_filter(this.search_input.getValue());
		this.tui.requestRender();
	}

	get_search_value(): string {
		return this.search_input.getValue();
	}

	private update_header(): void {
		const open_count = this.all_todos.filter((todo) => !is_todo_closed(todo.status)).length;
		const closed_count = this.all_todos.length - open_count;
		const title = `Todos (${open_count} open, ${closed_count} closed)`;
		this.header_text.setText(this.theme.fg("accent", this.theme.bold(title)));
	}

	private update_hints(): void {
		this.hint_text.setText(
			this.theme.fg(
				"dim",
				"Type to search • ↑↓ select • Enter actions • Ctrl+Shift+W work • Ctrl+Shift+R refine • Esc close",
			),
		);
	}

	private apply_filter(query: string): void {
		this.filtered_todos = filter_todos(this.all_todos, query);
		this.selected_index = Math.min(this.selected_index, Math.max(0, this.filtered_todos.length - 1));
		this.update_list();
	}

	private update_list(): void {
		this.list_container.clear();

		if (this.filtered_todos.length === 0) {
			this.list_container.addChild(new Text(this.theme.fg("muted", "  No matching todos"), 0, 0));
			return;
		}

		const max_visible = 10;
		const start_index = Math.max(
			0,
			Math.min(this.selected_index - Math.floor(max_visible / 2), this.filtered_todos.length - max_visible),
		);
		const end_index = Math.min(start_index + max_visible, this.filtered_todos.length);

		for (let i = start_index; i < end_index; i += 1) {
			const todo = this.filtered_todos[i];
			if (!todo) continue;
			const is_selected = i === this.selected_index;
			const closed = is_todo_closed(todo.status);
			const prefix = is_selected ? this.theme.fg("accent", "→ ") : "  ";
			const title_color = is_selected ? "accent" : closed ? "dim" : "text";
			const status_color = closed ? "dim" : "success";
			const tag_text = todo.tags.length ? ` [${todo.tags.join(", ")}]` : "";
			const assignment_text = render_assignment_suffix(this.theme, todo, this.current_session_id);
			const line =
				prefix +
				this.theme.fg("accent", format_todo_id(todo.id)) +
				" " +
				this.theme.fg(title_color, todo.title || "(untitled)") +
				this.theme.fg("muted", tag_text) +
				assignment_text +
				" " +
				this.theme.fg(status_color, `(${todo.status || "open"})`);
			this.list_container.addChild(new Text(line, 0, 0));
		}

		if (start_index > 0 || end_index < this.filtered_todos.length) {
			const scroll_info = this.theme.fg("dim", `  (${this.selected_index + 1}/${this.filtered_todos.length})`);
			this.list_container.addChild(new Text(scroll_info, 0, 0));
		}
	}

	handleInput(key_data: string): void {
		const kb = getEditorKeybindings();
		if (kb.matches(key_data, "selectUp")) {
			if (this.filtered_todos.length === 0) return;
			this.selected_index = this.selected_index === 0 ? this.filtered_todos.length - 1 : this.selected_index - 1;
			this.update_list();
			return;
		}
		if (kb.matches(key_data, "selectDown")) {
			if (this.filtered_todos.length === 0) return;
			this.selected_index = this.selected_index === this.filtered_todos.length - 1 ? 0 : this.selected_index + 1;
			this.update_list();
			return;
		}
		if (kb.matches(key_data, "selectConfirm")) {
			const selected = this.filtered_todos[this.selected_index];
			if (selected) this.on_select_callback(selected);
			return;
		}
		if (kb.matches(key_data, "selectCancel")) {
			this.on_cancel_callback();
			return;
		}
		if (matchesKey(key_data, Key.ctrlShift("r"))) {
			const selected = this.filtered_todos[this.selected_index];
			if (selected && this.on_quick_action) this.on_quick_action(selected, "refine");
			return;
		}
		if (matchesKey(key_data, Key.ctrlShift("w"))) {
			const selected = this.filtered_todos[this.selected_index];
			if (selected && this.on_quick_action) this.on_quick_action(selected, "work");
			return;
		}
		this.search_input.handleInput(key_data);
		this.apply_filter(this.search_input.getValue());
	}

	override invalidate(): void {
		super.invalidate();
		this.update_header();
		this.update_hints();
		this.update_list();
	}
}
