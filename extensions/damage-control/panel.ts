import { execSync } from "node:child_process";
import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { DAMAGE_CONTROL_PANEL_LOG_LIMIT, DAMAGE_CONTROL_STATUS_ICON } from "./constants.js";
import { truncate_preview } from "./matcher.js";
import type { ActiveRules, DamageControlFooterState, DamageControlPanelRow, RuleSourceKind } from "./types.js";

type PanelView = "list" | "detail";

interface ShowDamageControlPanelOptions {
	active_rules: ActiveRules;
	loaded_sources: RuleSourceKind[];
	get_rows: (limit: number) => DamageControlPanelRow[];
	get_footer_state: () => DamageControlFooterState;
	is_enabled: () => boolean;
	on_toggle_enabled: () => void;
	shortcut_key: string;
	on_panel_open?: (close_panel: () => void) => void;
}

export async function show_damage_control_panel(
	ctx: ExtensionContext,
	options: ShowDamageControlPanelOptions,
): Promise<void> {
	await ctx.ui.custom<void>(
		(tui, theme, _keybindings, done) => {
			const panel = new DamageControlPanel(tui, theme, options, done);
			options.on_panel_open?.(() => done());
			return panel;
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "center",
				width: 72,
				maxHeight: "70%",
			},
		},
	);
}

// ───────────────────────────────────────────────────────────────────
// Panel component
// ───────────────────────────────────────────────────────────────────

export class DamageControlPanel {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly options: ShowDamageControlPanelOptions;
	private readonly done: () => void;
	private rows: DamageControlPanelRow[] = [];
	private rows_total = 0;
	private scroll_offset = 0;
	private scroll_view_height = 0;

	// navigation & detail view state
	private view: PanelView = "list";
	private selected_index = 0;
	private detail_scroll_offset = 0;
	private detail_lines: string[] = [];
	private detail_view_height = 0;

	constructor(tui: TUI, theme: Theme, options: ShowDamageControlPanelOptions, done: () => void) {
		this.tui = tui;
		this.theme = theme;
		this.options = options;
		this.done = done;
		this.rows = options.get_rows(DAMAGE_CONTROL_PANEL_LOG_LIMIT);
	}

	handleInput(key_data: string): void {
		// ctrl+c always closes immediately
		if (matchesKey(key_data, "ctrl+c")) {
			this.done();
			return;
		}

		if (this.view === "detail") {
			this.handle_detail_input(key_data);
		} else {
			this.handle_list_input(key_data);
		}
	}

	render(width: number): string[] {
		if (this.view === "detail") {
			return this.render_detail_view(width);
		}
		return this.render_list_view(width);
	}

	invalidate(): void {}

	// ── List view input handling ─────────────────────────────

	private handle_list_input(key_data: string): void {
		if (matchesKey(key_data, "escape") || matchesKey(key_data, "q")) {
			this.done();
			return;
		}
		if (matchesKey(key_data, this.options.shortcut_key)) {
			this.done();
			return;
		}
		if (matchesKey(key_data, "d")) {
			this.options.on_toggle_enabled();
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "r")) {
			this.refresh();
			return;
		}
		if (matchesKey(key_data, "enter")) {
			if (this.rows.length > 0) {
				this.open_detail_view();
			}
			return;
		}

		// Navigation
		if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
			this.move_selection(1);
			return;
		}
		if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
			this.move_selection(-1);
			return;
		}
		if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
			this.set_selection(0);
			return;
		}
		if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
			this.set_selection(this.rows.length - 1);
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			this.move_selection(this.scroll_view_height || 1);
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			this.move_selection(-(this.scroll_view_height || 1));
			return;
		}
	}

	// ── Detail view input handling ───────────────────────────

	private handle_detail_input(key_data: string): void {
		if (matchesKey(key_data, "escape") || matchesKey(key_data, "q")) {
			this.view = "list";
			this.detail_scroll_offset = 0;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, this.options.shortcut_key)) {
			this.view = "list";
			this.detail_scroll_offset = 0;
			this.tui.requestRender();
			return;
		}

		// Scrolling
		if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
			this.scroll_detail(1);
			return;
		}
		if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
			this.scroll_detail(-1);
			return;
		}
		if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
			this.detail_scroll_offset = 0;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
			const max_scroll = Math.max(0, this.detail_lines.length - this.detail_view_height);
			this.detail_scroll_offset = max_scroll;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			this.scroll_detail(this.detail_view_height || 1);
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			this.scroll_detail(-(this.detail_view_height || 1));
			return;
		}

		// Copy input to clipboard
		if (matchesKey(key_data, "c")) {
			this.copy_input_to_clipboard();
			return;
		}
	}

	// ── Clipboard ────────────────────────────────────────────

	private copy_flash_until = 0;

	private copy_input_to_clipboard(): void {
		const row = this.rows[this.selected_index];
		if (!row || row.input_preview.trim().length === 0) return;

		try {
			execSync("pbcopy", { input: row.input_preview, stdio: ["pipe", "ignore", "ignore"] });
		} catch {
			// pbcopy not available (non-macOS) — try xclip/xsel as fallback
			try {
				execSync("xclip -selection clipboard", {
					input: row.input_preview,
					stdio: ["pipe", "ignore", "ignore"],
				});
			} catch {
				// No clipboard tool available — silently fail
				return;
			}
		}

		// Brief "copied!" flash in footer
		this.copy_flash_until = Date.now() + 1500;
		this.tui.requestRender();

		// Clear the flash after timeout
		setTimeout(() => {
			this.tui.requestRender();
		}, 1600);
	}

	// ── List view rendering ──────────────────────────────────

	private render_list_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2; // inner width (minus borders)

		const max_h = this.get_max_height();
		const rules = this.options.active_rules;
		const sources = this.options.loaded_sources;
		const state = this.options.get_footer_state();

		// ── build content lines ──────────────────────────────
		const content: string[] = [];

		// title row
		const is_enabled = this.options.is_enabled();
		const icon_color = !is_enabled
			? "dim"
			: state === "incident"
				? "error"
				: state === "notify"
					? "warning"
					: "success";
		const icon = t.fg(icon_color, DAMAGE_CONTROL_STATUS_ICON);
		const source_label = sources.length > 0 ? sources.join(", ") : "none";
		const status_badge = is_enabled ? t.fg("success", "enabled") : t.fg("error", "DISABLED");
		content.push(`${icon} ${t.fg("accent", t.bold("Damage Control"))}  ${status_badge}  ${t.fg("dim", source_label)}`);

		// divider
		content.push(t.fg("dim", "─".repeat(iw)));

		// rule gauges — two per row, compact and readable
		const bash_n = rules.bash_tool_patterns.length;
		const zero_n = rules.zero_access_paths.length;
		const ro_n = rules.read_only_paths.length;
		const nd_n = rules.no_delete_paths.length;

		const gauge = (label: string, count: number, color: string) => {
			const num = t.fg(color, `${count}`);
			return `${num} ${t.fg("muted", label)}`;
		};

		const row_1 = `  ${gauge("bash patterns", bash_n, "accent")}    ${gauge("zero-access", zero_n, "accent")}`;
		const row_2 = `  ${gauge("read-only", ro_n, "accent")}       ${gauge("no-delete", nd_n, "accent")}`;
		content.push(row_1);
		content.push(row_2);

		// divider + activity header
		content.push(t.fg("dim", "─".repeat(iw)));

		const event_count = this.rows.length;
		if (event_count === 0) {
			content.push(t.fg("dim", "  No policy events in this branch."));
		} else {
			content.push(t.fg("muted", `  Events (${event_count})`));
		}

		// activity rows (scrollable region starts here)
		const header_count = content.length;
		const footer_count = 2; // divider + key hints
		const border_count = 2; // top + bottom border
		this.scroll_view_height = Math.max(1, max_h - header_count - footer_count - border_count);

		const formatted_rows = this.rows.map((row, idx) => format_event_row(t, row, iw, idx === this.selected_index));
		this.rows_total = formatted_rows.length;

		// auto-scroll to keep selected row visible
		this.ensure_selection_visible();

		const visible = formatted_rows.slice(this.scroll_offset, this.scroll_offset + this.scroll_view_height);
		content.push(...visible);

		// pad to fill view height
		const fill_count = this.scroll_view_height - visible.length;
		for (let i = 0; i < fill_count; i++) {
			content.push("");
		}

		// footer
		content.push(t.fg("dim", "─".repeat(iw)));

		const toggle_label = is_enabled ? "disable" : "enable";
		const hints: string[] = [
			`${t.fg("accent", "esc")} close`,
			`${t.fg("accent", "d")} ${toggle_label}`,
			`${t.fg("accent", "r")} refresh`,
		];
		if (event_count > 0) {
			hints.push(`${t.fg("accent", "j/k")} navigate`);
			hints.push(`${t.fg("accent", "enter")} detail`);
		}
		if (this.rows_total > this.scroll_view_height) {
			const start = this.scroll_offset + 1;
			const end = Math.min(this.rows_total, this.scroll_offset + this.scroll_view_height);
			hints.push(t.fg("dim", `${start}-${end}/${this.rows_total}`));
		}
		content.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── frame with border ────────────────────────────────
		return this.frame_content(content, w, iw);
	}

	// ── Detail view rendering ────────────────────────────────

	private render_detail_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;

		const max_h = this.get_max_height();
		const sources = this.options.loaded_sources;
		const state = this.options.get_footer_state();

		const row = this.rows[this.selected_index];
		if (!row) {
			// shouldn't happen, but fall back to list
			this.view = "list";
			return this.render_list_view(width);
		}

		// ── build header (non-scrollable) ────────────────────
		const header: string[] = [];

		// title row (same as list view)
		const is_enabled = this.options.is_enabled();
		const icon_color = !is_enabled
			? "dim"
			: state === "incident"
				? "error"
				: state === "notify"
					? "warning"
					: "success";
		const icon = t.fg(icon_color, DAMAGE_CONTROL_STATUS_ICON);
		const source_label = sources.length > 0 ? sources.join(", ") : "none";
		const status_badge = is_enabled ? t.fg("success", "enabled") : t.fg("error", "DISABLED");
		header.push(`${icon} ${t.fg("accent", t.bold("Damage Control"))}  ${status_badge}  ${t.fg("dim", source_label)}`);

		// divider
		header.push(t.fg("dim", "─".repeat(iw)));

		// detail title
		const action_style = get_action_style(row.action);
		const badge = t.fg(action_style.color, action_style.symbol);
		header.push(`${badge} ${t.fg("accent", t.bold("Event Detail"))}`);

		// divider
		header.push(t.fg("dim", "─".repeat(iw)));

		// ── build scrollable detail content ──────────────────
		const detail_content: string[] = [];
		const label_width = 12;
		const value_width = Math.max(10, iw - label_width - 4); // 4 = padding

		const field = (label: string, value: string) => {
			const lbl = t.fg("muted", label.padEnd(label_width));
			return `  ${lbl}${value}`;
		};

		detail_content.push("");
		detail_content.push(field("Action", `${badge} ${action_label(row.action)}`));
		detail_content.push(field("Tool", t.fg("accent", row.tool_name)));
		detail_content.push(field("Time", row.timestamp));
		detail_content.push(field("Rule Type", row.rule_type));
		detail_content.push(field("Source", row.rule_source));
		detail_content.push("");

		// Reason section
		detail_content.push(t.fg("dim", "─".repeat(iw)));
		detail_content.push(`  ${t.fg("muted", "Reason")}`);
		const reason_lines = wrap_plain_text(row.reason, value_width);
		for (const line of reason_lines) {
			detail_content.push(`  ${line}`);
		}
		detail_content.push("");

		// Input section — rendered as a code block with gutter
		detail_content.push(t.fg("dim", "─".repeat(iw)));
		detail_content.push(`  ${t.fg("muted", "Input")}`);
		if (row.input_preview.trim().length === 0) {
			detail_content.push(`  ${t.fg("dim", "(no input captured)")}`);
		} else {
			// Code block: dim gutter bar + accent-colored content
			const code_iw = Math.max(8, iw - 6); // 6 = "  │ " prefix + 2 margin
			const input_lines = wrap_plain_text(row.input_preview, code_iw);
			for (const line of input_lines) {
				detail_content.push(`  ${t.fg("dim", "│")} ${t.fg("accent", line)}`);
			}
		}
		detail_content.push("");

		this.detail_lines = detail_content;

		// ── calculate scrollable area ────────────────────────
		const footer_count = 2; // divider + key hints
		const border_count = 2;
		this.detail_view_height = Math.max(1, max_h - header.length - footer_count - border_count);

		const max_scroll = Math.max(0, this.detail_lines.length - this.detail_view_height);
		this.detail_scroll_offset = Math.max(0, Math.min(this.detail_scroll_offset, max_scroll));

		const visible = this.detail_lines.slice(
			this.detail_scroll_offset,
			this.detail_scroll_offset + this.detail_view_height,
		);

		// ── build footer ─────────────────────────────────────
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const is_flash = Date.now() < this.copy_flash_until;
		const hints: string[] = [`${t.fg("accent", "esc")} back`];

		if (is_flash) {
			hints.push(t.fg("success", "✓ copied!"));
		} else {
			const has_input = row && row.input_preview.trim().length > 0;
			if (has_input) {
				hints.push(`${t.fg("accent", "c")} copy input`);
			}
		}

		if (this.detail_lines.length > this.detail_view_height) {
			const start = this.detail_scroll_offset + 1;
			const end = Math.min(this.detail_lines.length, this.detail_scroll_offset + this.detail_view_height);
			hints.push(`${t.fg("accent", "↑↓/jk")} scroll`);
			hints.push(t.fg("dim", `${start}-${end}/${this.detail_lines.length}`));
		}
		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── assemble and pad ─────────────────────────────────
		const content = [...header, ...visible];

		// pad to fill view height
		const fill_count = this.detail_view_height - visible.length;
		for (let i = 0; i < fill_count; i++) {
			content.push("");
		}

		content.push(...footer);

		return this.frame_content(content, w, iw);
	}

	// ── Selection & scroll helpers ───────────────────────────

	private move_selection(delta: number): void {
		if (this.rows.length === 0) return;
		const new_idx = Math.max(0, Math.min(this.selected_index + delta, this.rows.length - 1));
		if (new_idx === this.selected_index) return;
		this.selected_index = new_idx;
		this.tui.requestRender();
	}

	private set_selection(index: number): void {
		if (this.rows.length === 0) return;
		const new_idx = Math.max(0, Math.min(index, this.rows.length - 1));
		if (new_idx === this.selected_index) return;
		this.selected_index = new_idx;
		this.tui.requestRender();
	}

	private ensure_selection_visible(): void {
		if (this.rows_total === 0) return;
		if (this.selected_index < this.scroll_offset) {
			this.scroll_offset = this.selected_index;
		} else if (this.selected_index >= this.scroll_offset + this.scroll_view_height) {
			this.scroll_offset = this.selected_index - this.scroll_view_height + 1;
		}
		const max_scroll = Math.max(0, this.rows_total - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));
	}

	private scroll_detail(delta: number): void {
		const max_scroll = Math.max(0, this.detail_lines.length - this.detail_view_height);
		const new_offset = Math.max(0, Math.min(this.detail_scroll_offset + delta, max_scroll));
		if (new_offset === this.detail_scroll_offset) return;
		this.detail_scroll_offset = new_offset;
		this.tui.requestRender();
	}

	private open_detail_view(): void {
		this.view = "detail";
		this.detail_scroll_offset = 0;
		this.tui.requestRender();
	}

	private refresh(): void {
		this.rows = this.options.get_rows(DAMAGE_CONTROL_PANEL_LOG_LIMIT);
		this.selected_index = this.rows.length > 0 ? Math.min(this.selected_index, this.rows.length - 1) : 0;
		this.scroll_offset = 0;
		this.detail_scroll_offset = 0;
		if (this.view === "detail") {
			this.view = "list";
		}
		this.tui.requestRender();
	}

	// ── Framing helper ───────────────────────────────────────

	private frame_content(content: string[], w: number, iw: number): string[] {
		const bdr = (s: string) => this.theme.fg("borderMuted", s);

		const framed = content.map((line) => {
			const padded = pad_to_width(truncateToWidth(line, iw), iw);
			return bdr("│") + padded + bdr("│");
		});

		return [bdr(`╭${"─".repeat(iw)}╮`), ...framed, bdr(`╰${"─".repeat(iw)}╯`)].map((l) => truncateToWidth(l, w));
	}

	private get_max_height(): number {
		const rows = this.tui.terminal.rows || 24;
		return Math.max(12, Math.floor(rows * 0.7));
	}
}

// ───────────────────────────────────────────────────────────────────
// Event row formatting
// ───────────────────────────────────────────────────────────────────

function format_event_row(theme: Theme, row: DamageControlPanelRow, max_width: number, selected: boolean): string {
	const action_style = get_action_style(row.action);
	const badge = theme.fg(action_style.color, action_style.symbol);
	const tool = theme.fg("accent", row.tool_name);
	const time = theme.fg("dim", format_time(row.timestamp));
	const source = theme.fg("dim", row.rule_source);

	// selection marker: ▸ for selected, space for others
	const marker = selected ? theme.fg("accent", "▸") : " ";

	// first line: marker + badge + action + tool + time
	const header = `${marker} ${badge} ${tool}  ${time}  ${source}`;

	// reason on the same line, truncated to fit
	const header_vis = visibleWidth(header);
	const remaining = Math.max(0, max_width - header_vis - 2);
	if (remaining > 10) {
		const reason = theme.fg("muted", truncate_preview(row.reason, remaining));
		return `${header}  ${reason}`;
	}
	return header;
}

function get_action_style(action: DamageControlPanelRow["action"]): { color: string; symbol: string } {
	switch (action) {
		case "blocked":
			return { color: "error", symbol: "✕" };
		case "blocked_by_user":
			return { color: "error", symbol: "✕" };
		case "confirmed_by_user":
			return { color: "warning", symbol: "✓" };
		case "allowed":
			return { color: "success", symbol: "·" };
	}
}

function action_label(action: DamageControlPanelRow["action"]): string {
	switch (action) {
		case "blocked":
			return "blocked";
		case "blocked_by_user":
			return "blocked by user";
		case "confirmed_by_user":
			return "confirmed by user";
		case "allowed":
			return "allowed";
	}
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function format_time(value: string): string {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

function p2(n: number): string {
	return `${n}`.padStart(2, "0");
}

function pad_to_width(value: string, width: number): string {
	const vis = visibleWidth(value);
	if (vis >= width) return truncateToWidth(value, width);
	return value + " ".repeat(width - vis);
}

function wrap_plain_text(text: string, width: number): string[] {
	if (text.length === 0) return [""];
	const lines = wrapTextWithAnsi(text, width);
	// Fallback: hard-truncate any line that still exceeds width (e.g. single long word)
	return lines.map((line) => truncateToWidth(line, width));
}
