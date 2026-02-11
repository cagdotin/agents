import { getMarkdownTheme, type Theme } from "@mariozechner/pi-coding-agent";
import {
	Markdown,
	type TUI,
	getEditorKeybindings,
	truncateToWidth,
	visibleWidth,
} from "@mariozechner/pi-tui";
import type { TodoRecord, TodoOverlayAction } from "../types.js";
import { format_todo_id, is_todo_closed } from "../helpers.js";

export class TodoDetailOverlayComponent {
	private todo: TodoRecord;
	private theme: Theme;
	private tui: TUI;
	private markdown: Markdown;
	private scroll_offset = 0;
	private view_height = 0;
	private total_lines = 0;
	private on_action: (action: TodoOverlayAction) => void;

	constructor(
		tui: TUI,
		theme: Theme,
		todo: TodoRecord,
		on_action: (action: TodoOverlayAction) => void,
	) {
		this.tui = tui;
		this.theme = theme;
		this.todo = todo;
		this.on_action = on_action;
		this.markdown = new Markdown(this.get_markdown_text(), 1, 0, getMarkdownTheme());
	}

	private get_markdown_text(): string {
		const body = this.todo.body?.trim();
		return body ? body : "_No details yet._";
	}

	handleInput(key_data: string): void {
		const kb = getEditorKeybindings();
		if (kb.matches(key_data, "selectCancel")) {
			this.on_action("back");
			return;
		}
		if (kb.matches(key_data, "selectConfirm")) {
			this.on_action("work");
			return;
		}
		if (kb.matches(key_data, "selectUp")) {
			this.scroll_by(-1);
			return;
		}
		if (kb.matches(key_data, "selectDown")) {
			this.scroll_by(1);
			return;
		}
		if (kb.matches(key_data, "selectPageUp")) {
			this.scroll_by(-this.view_height || -1);
			return;
		}
		if (kb.matches(key_data, "selectPageDown")) {
			this.scroll_by(this.view_height || 1);
			return;
		}
	}

	render(width: number): string[] {
		const max_height = this.get_max_height();
		const header_lines = 3;
		const footer_lines = 3;
		const border_lines = 2;
		const inner_width = Math.max(10, width - 2);
		const content_height = Math.max(1, max_height - header_lines - footer_lines - border_lines);

		const markdown_lines = this.markdown.render(inner_width);
		this.total_lines = markdown_lines.length;
		this.view_height = content_height;
		const max_scroll = Math.max(0, this.total_lines - content_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));

		const visible_lines = markdown_lines.slice(this.scroll_offset, this.scroll_offset + content_height);
		const lines: string[] = [];

		lines.push(this.build_title_line(inner_width));
		lines.push(this.build_meta_line(inner_width));
		lines.push("");

		for (const line of visible_lines) {
			lines.push(truncateToWidth(line, inner_width));
		}
		while (lines.length < header_lines + content_height) {
			lines.push("");
		}

		lines.push("");
		lines.push(this.build_action_line(inner_width));

		const border_color = (text: string) => this.theme.fg("borderMuted", text);
		const top = border_color(`┌${"─".repeat(inner_width)}┐`);
		const bottom = border_color(`└${"─".repeat(inner_width)}┘`);
		const framed_lines = lines.map((line) => {
			const truncated = truncateToWidth(line, inner_width);
			const padding = Math.max(0, inner_width - visibleWidth(truncated));
			return border_color("│") + truncated + " ".repeat(padding) + border_color("│");
		});

		return [top, ...framed_lines, bottom].map((line) => truncateToWidth(line, width));
	}

	invalidate(): void {
		this.markdown = new Markdown(this.get_markdown_text(), 1, 0, getMarkdownTheme());
	}

	private get_max_height(): number {
		const rows = this.tui.terminal.rows || 24;
		return Math.max(10, Math.floor(rows * 0.8));
	}

	private build_title_line(width: number): string {
		const title_text = this.todo.title
			? ` ${this.todo.title} `
			: ` Todo ${format_todo_id(this.todo.id)} `;
		const title_width = visibleWidth(title_text);
		if (title_width >= width) {
			return truncateToWidth(this.theme.fg("accent", title_text.trim()), width);
		}
		const left_width = Math.max(0, Math.floor((width - title_width) / 2));
		const right_width = Math.max(0, width - title_width - left_width);
		return (
			this.theme.fg("borderMuted", "─".repeat(left_width)) +
			this.theme.fg("accent", title_text) +
			this.theme.fg("borderMuted", "─".repeat(right_width))
		);
	}

	private build_meta_line(width: number): string {
		const status = this.todo.status || "open";
		const status_color = is_todo_closed(status) ? "dim" : "success";
		const tag_text = this.todo.tags.length ? this.todo.tags.join(", ") : "no tags";
		const line =
			this.theme.fg("accent", format_todo_id(this.todo.id)) +
			this.theme.fg("muted", " • ") +
			this.theme.fg(status_color, status) +
			this.theme.fg("muted", " • ") +
			this.theme.fg("muted", tag_text);
		return truncateToWidth(line, width);
	}

	private build_action_line(width: number): string {
		const work = this.theme.fg("accent", "enter") + this.theme.fg("muted", " work on todo");
		const back = this.theme.fg("dim", "esc back");
		const pieces = [work, back];

		let line = pieces.join(this.theme.fg("muted", " • "));
		if (this.total_lines > this.view_height) {
			const start = Math.min(this.total_lines, this.scroll_offset + 1);
			const end = Math.min(this.total_lines, this.scroll_offset + this.view_height);
			const scroll_info = this.theme.fg("dim", ` ${start}-${end}/${this.total_lines}`);
			line += scroll_info;
		}

		return truncateToWidth(line, width);
	}

	private scroll_by(delta: number): void {
		const max_scroll = Math.max(0, this.total_lines - this.view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset + delta, max_scroll));
	}
}
