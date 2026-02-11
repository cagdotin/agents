/**
 * Interactive Q&A TUI component.
 *
 * Presents extracted questions one at a time with an inline editor
 * for the user to type answers. Supports keyboard navigation between
 * questions, a visual progress indicator, and a confirmation dialog
 * before submitting.
 *
 * Layout:
 * ╭──────────────────────────────────╮
 * │  Questions (1/3)                 │
 * ├──────────────────────────────────┤
 * │  ● ○ ○                          │ ← progress dots
 * │                                  │
 * │  Q: What database to use?        │
 * │  > MySQL or PostgreSQL only      │ ← optional context
 * │                                  │
 * │  A: [editor input here]          │
 * │                                  │
 * ├──────────────────────────────────┤
 * │  Tab next · Shift+Tab prev · …   │
 * ╰──────────────────────────────────╯
 */

import type { Component, TUI } from "@mariozechner/pi-tui";
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import type { ExtractedQuestion } from "../types.js";
import { ansi, format_answers } from "../helpers.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum width of the Q&A box (content area). */
const MAX_BOX_WIDTH = 120;

/** Padding inside the box on each side. */
const BOX_PADDING = 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class QnAComponent implements Component {
	private questions: ExtractedQuestion[];
	private answers: string[];
	private current_index = 0;
	private editor: Editor;
	private tui: TUI;
	private on_done: (result: string | null) => void;
	private showing_confirmation = false;

	// Render cache
	private cached_width?: number;
	private cached_lines?: string[];

	constructor(
		questions: ExtractedQuestion[],
		tui: TUI,
		on_done: (result: string | null) => void,
	) {
		this.questions = questions;
		this.answers = questions.map(() => "");
		this.tui = tui;
		this.on_done = on_done;

		const editor_theme: EditorTheme = {
			borderColor: ansi.dim,
			selectList: {
				selectedBg: (s: string) => `\x1b[44m${s}\x1b[0m`,
				matchHighlight: ansi.cyan,
				itemSecondary: ansi.gray,
			},
		};

		this.editor = new Editor(tui, editor_theme);
		// Disable the editor's built-in submit so we can handle Enter ourselves
		// (plain Enter navigates to the next question; Shift+Enter inserts a newline)
		this.editor.disableSubmit = true;
		this.editor.onChange = () => {
			this.invalidate();
			this.tui.requestRender();
		};
	}

	// -----------------------------------------------------------------------
	// State helpers
	// -----------------------------------------------------------------------

	/** Persist the current editor text into the answers array. */
	private save_current_answer(): void {
		this.answers[this.current_index] = this.editor.getText();
	}

	/** Navigate to a different question by index, saving the current answer first. */
	private navigate_to(index: number): void {
		if (index < 0 || index >= this.questions.length) return;
		this.save_current_answer();
		this.current_index = index;
		this.editor.setText(this.answers[index] || "");
		this.invalidate();
	}

	/** Compile and return all answers via the done callback. */
	private submit(): void {
		this.save_current_answer();
		this.on_done(format_answers(this.questions, this.answers));
	}

	/** Cancel the Q&A session. */
	private cancel(): void {
		this.on_done(null);
	}

	// -----------------------------------------------------------------------
	// Component interface
	// -----------------------------------------------------------------------

	invalidate(): void {
		this.cached_width = undefined;
		this.cached_lines = undefined;
	}

	handleInput(data: string): void {
		// --- Confirmation dialog ---
		if (this.showing_confirmation) {
			if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
				this.submit();
				return;
			}
			if (
				matchesKey(data, Key.escape) ||
				matchesKey(data, Key.ctrl("c")) ||
				data.toLowerCase() === "n"
			) {
				this.showing_confirmation = false;
				this.invalidate();
				this.tui.requestRender();
				return;
			}
			return;
		}

		// --- Global shortcuts ---
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.cancel();
			return;
		}

		// Tab / Shift+Tab – navigate between questions
		if (matchesKey(data, Key.tab)) {
			if (this.current_index < this.questions.length - 1) {
				this.navigate_to(this.current_index + 1);
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(data, Key.shift("tab"))) {
			if (this.current_index > 0) {
				this.navigate_to(this.current_index - 1);
				this.tui.requestRender();
			}
			return;
		}

		// Arrow up/down for question navigation when editor is empty
		if (matchesKey(data, Key.up) && this.editor.getText() === "") {
			if (this.current_index > 0) {
				this.navigate_to(this.current_index - 1);
				this.tui.requestRender();
				return;
			}
		}
		if (matchesKey(data, Key.down) && this.editor.getText() === "") {
			if (this.current_index < this.questions.length - 1) {
				this.navigate_to(this.current_index + 1);
				this.tui.requestRender();
				return;
			}
		}

		// Plain Enter – advance to next question or show confirmation on last
		if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
			this.save_current_answer();
			if (this.current_index < this.questions.length - 1) {
				this.navigate_to(this.current_index + 1);
			} else {
				this.showing_confirmation = true;
			}
			this.invalidate();
			this.tui.requestRender();
			return;
		}

		// Everything else goes to the editor (including Shift+Enter for newlines)
		this.editor.handleInput(data);
		this.invalidate();
		this.tui.requestRender();
	}

	render(width: number): string[] {
		if (this.cached_lines && this.cached_width === width) {
			return this.cached_lines;
		}

		const lines: string[] = [];
		const box_width = Math.min(width - 4, MAX_BOX_WIDTH);
		const content_width = box_width - BOX_PADDING * 2;

		// --- Box drawing helpers ---

		const h_line = (count: number) => "─".repeat(count);

		const box_line = (content: string, left_pad = BOX_PADDING): string => {
			const padded = " ".repeat(left_pad) + content;
			const content_len = visibleWidth(padded);
			const right_pad = Math.max(0, box_width - content_len - 2);
			return ansi.dim("│") + padded + " ".repeat(right_pad) + ansi.dim("│");
		};

		const empty_box_line = (): string =>
			ansi.dim("│") + " ".repeat(box_width - 2) + ansi.dim("│");

		const pad_to_width = (line: string): string => {
			const len = visibleWidth(line);
			return line + " ".repeat(Math.max(0, width - len));
		};

		// --- Title ---
		lines.push(pad_to_width(ansi.dim("╭" + h_line(box_width - 2) + "╮")));
		const title = `${ansi.bold(ansi.cyan("Questions"))} ${ansi.dim(`(${this.current_index + 1}/${this.questions.length})`)}`;
		lines.push(pad_to_width(box_line(title)));
		lines.push(pad_to_width(ansi.dim("├" + h_line(box_width - 2) + "┤")));

		// --- Progress dots ---
		const progress_parts: string[] = [];
		for (let i = 0; i < this.questions.length; i++) {
			const answered = (this.answers[i]?.trim() || "").length > 0;
			const current = i === this.current_index;
			if (current) {
				progress_parts.push(ansi.cyan("●"));
			} else if (answered) {
				progress_parts.push(ansi.green("●"));
			} else {
				progress_parts.push(ansi.dim("○"));
			}
		}
		lines.push(pad_to_width(box_line(progress_parts.join(" "))));
		lines.push(pad_to_width(empty_box_line()));

		// --- Current question ---
		const q = this.questions[this.current_index];
		const question_text = `${ansi.bold("Q:")} ${q.question}`;
		for (const line of wrapTextWithAnsi(question_text, content_width)) {
			lines.push(pad_to_width(box_line(line)));
		}

		// Optional context block
		if (q.context) {
			lines.push(pad_to_width(empty_box_line()));
			const context_text = ansi.gray(`> ${q.context}`);
			for (const line of wrapTextWithAnsi(context_text, content_width - 2)) {
				lines.push(pad_to_width(box_line(line)));
			}
		}

		lines.push(pad_to_width(empty_box_line()));

		// --- Editor (answer input) ---
		const answer_prefix = ansi.bold("A: ");
		const editor_width = content_width - 4 - 3; // extra padding + "A: " width
		const editor_lines = this.editor.render(editor_width);
		// Skip first and last lines (editor's own border decoration)
		for (let i = 1; i < editor_lines.length - 1; i++) {
			if (i === 1) {
				lines.push(pad_to_width(box_line(answer_prefix + editor_lines[i])));
			} else {
				lines.push(pad_to_width(box_line("   " + editor_lines[i])));
			}
		}

		lines.push(pad_to_width(empty_box_line()));

		// --- Footer ---
		lines.push(pad_to_width(ansi.dim("├" + h_line(box_width - 2) + "┤")));

		if (this.showing_confirmation) {
			const confirm_msg = `${ansi.yellow("Submit all answers?")} ${ansi.dim("(Enter/y to confirm, Esc/n to cancel)")}`;
			lines.push(pad_to_width(box_line(truncateToWidth(confirm_msg, content_width))));
		} else {
			const controls = `${ansi.dim("Tab/Enter")} next · ${ansi.dim("Shift+Tab")} prev · ${ansi.dim("Shift+Enter")} newline · ${ansi.dim("Esc")} cancel`;
			lines.push(pad_to_width(box_line(truncateToWidth(controls, content_width))));
		}

		lines.push(pad_to_width(ansi.dim("╰" + h_line(box_width - 2) + "╯")));

		this.cached_width = width;
		this.cached_lines = lines;
		return lines;
	}
}
