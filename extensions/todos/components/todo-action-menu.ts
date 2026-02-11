import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, SelectList, Text, type SelectItem } from "@mariozechner/pi-tui";
import type { TodoRecord, TodoMenuAction } from "../types.js";
import { format_todo_id, is_todo_closed } from "../helpers.js";

export class TodoActionMenuComponent extends Container {
	private select_list: SelectList;
	private on_select_callback: (action: TodoMenuAction) => void;
	private on_cancel_callback: () => void;

	constructor(
		theme: Theme,
		todo: TodoRecord,
		on_select: (action: TodoMenuAction) => void,
		on_cancel: () => void,
	) {
		super();
		this.on_select_callback = on_select;
		this.on_cancel_callback = on_cancel;

		const closed = is_todo_closed(todo.status);
		const title = todo.title || "(untitled)";
		const options: SelectItem[] = [
			{ value: "view", label: "view", description: "View todo" },
			{ value: "work", label: "work", description: "Work on todo" },
			{ value: "refine", label: "refine", description: "Refine task" },
			...(closed
				? [{ value: "reopen", label: "reopen", description: "Reopen todo" }]
				: [{ value: "close", label: "close", description: "Close todo" }]),
			...(todo.assigned_to_session
				? [{ value: "release", label: "release", description: "Release assignment" }]
				: []),
			{ value: "copyPath", label: "copy path", description: "Copy absolute path to clipboard" },
			{ value: "copyText", label: "copy text", description: "Copy title and body to clipboard" },
			{ value: "delete", label: "delete", description: "Delete todo" },
		];

		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		this.addChild(
			new Text(
				theme.fg(
					"accent",
					theme.bold(`Actions for ${format_todo_id(todo.id)} "${title}"`),
				),
			),
		);

		this.select_list = new SelectList(options, options.length, {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		this.select_list.onSelect = (item) => this.on_select_callback(item.value as TodoMenuAction);
		this.select_list.onCancel = () => this.on_cancel_callback();

		this.addChild(this.select_list);
		this.addChild(new Text(theme.fg("dim", "Enter to confirm • Esc back")));
		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
	}

	handleInput(key_data: string): void {
		this.select_list.handleInput(key_data);
	}

	override invalidate(): void {
		super.invalidate();
	}
}
