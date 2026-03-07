import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { DAMAGE_CONTROL_PANEL_LOG_LIMIT, DAMAGE_CONTROL_STATUS_ICON } from "./constants.js";
import { truncate_preview } from "./matcher.js";
import type { ActiveRules, DamageControlFooterState, DamageControlPanelRow, RuleSourceKind } from "./types.js";

interface ShowDamageControlPanelOptions {
	active_rules: ActiveRules;
	loaded_sources: RuleSourceKind[];
	get_rows: (limit: number) => DamageControlPanelRow[];
	get_footer_state: () => DamageControlFooterState;
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
				width: 56,
				maxHeight: "70%",
			},
		},
	);
}

// ───────────────────────────────────────────────────────────────────
// Panel component
// ───────────────────────────────────────────────────────────────────

class DamageControlPanel {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly options: ShowDamageControlPanelOptions;
	private readonly done: () => void;
	private rows: DamageControlPanelRow[] = [];
	private rows_total = 0;
	private scroll_offset = 0;
	private scroll_view_height = 0;

	constructor(tui: TUI, theme: Theme, options: ShowDamageControlPanelOptions, done: () => void) {
		this.tui = tui;
		this.theme = theme;
		this.options = options;
		this.done = done;
		this.rows = options.get_rows(DAMAGE_CONTROL_PANEL_LOG_LIMIT);
	}

	handleInput(key_data: string): void {
		if (matchesKey(key_data, "escape") || matchesKey(key_data, "ctrl+c") || matchesKey(key_data, "q")) {
			this.done();
			return;
		}
		if (matchesKey(key_data, this.options.shortcut_key)) {
			this.done();
			return;
		}
		if (matchesKey(key_data, "r")) {
			this.rows = this.options.get_rows(DAMAGE_CONTROL_PANEL_LOG_LIMIT);
			this.scroll_offset = 0;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "up")) {
			this.scroll(-1);
			return;
		}
		if (matchesKey(key_data, "down")) {
			this.scroll(1);
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			this.scroll(-(this.scroll_view_height || 1));
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			this.scroll(this.scroll_view_height || 1);
			return;
		}
	}

	render(width: number): string[] {
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
		const icon_color = state === "incident" ? "error" : state === "notify" ? "warning" : "success";
		const icon = t.fg(icon_color, DAMAGE_CONTROL_STATUS_ICON);
		const source_label = sources.length > 0 ? sources.join(", ") : "none";
		content.push(`${icon} ${t.fg("accent", t.bold("Damage Control"))}  ${t.fg("dim", source_label)}`);

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

		const formatted_rows = this.rows.map((row) => format_event_row(t, row, iw));
		this.rows_total = formatted_rows.length;
		const max_scroll = Math.max(0, this.rows_total - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));

		const visible = formatted_rows.slice(this.scroll_offset, this.scroll_offset + this.scroll_view_height);
		content.push(...visible);

		// pad to fill view height
		const fill_count = this.scroll_view_height - visible.length;
		for (let i = 0; i < fill_count; i++) {
			content.push("");
		}

		// footer
		content.push(t.fg("dim", "─".repeat(iw)));

		const hints: string[] = [`${t.fg("accent", "esc")} close`, `${t.fg("accent", "r")} refresh`];
		if (this.rows_total > this.scroll_view_height) {
			const pos = `${this.scroll_offset + 1}-${Math.min(this.rows_total, this.scroll_offset + this.scroll_view_height)}/${this.rows_total}`;
			hints.push(`${t.fg("accent", "↑↓")} scroll ${t.fg("dim", pos)}`);
		}
		content.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── frame with border ────────────────────────────────
		const bdr = (s: string) => t.fg("borderMuted", s);

		const framed = content.map((line) => {
			const padded = pad_to_width(truncateToWidth(line, iw), iw);
			return bdr("│") + padded + bdr("│");
		});

		return [bdr(`╭${"─".repeat(iw)}╮`), ...framed, bdr(`╰${"─".repeat(iw)}╯`)].map((l) => truncateToWidth(l, w));
	}

	invalidate(): void {}

	private scroll(delta: number): void {
		const max_scroll = Math.max(0, this.rows_total - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset + delta, max_scroll));
		this.tui.requestRender();
	}

	private get_max_height(): number {
		const rows = this.tui.terminal.rows || 24;
		return Math.max(12, Math.floor(rows * 0.7));
	}
}

// ───────────────────────────────────────────────────────────────────
// Event row formatting
// ───────────────────────────────────────────────────────────────────

function format_event_row(theme: Theme, row: DamageControlPanelRow, max_width: number): string {
	const action_style = get_action_style(row.action);
	const badge = theme.fg(action_style.color, action_style.symbol);
	const tool = theme.fg("accent", row.tool_name);
	const time = theme.fg("dim", format_time(row.timestamp));
	const source = theme.fg("dim", row.rule_source);

	// first line: badge + action + tool + time
	const header = `  ${badge} ${tool}  ${time}  ${source}`;

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
