import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { SESSION_STATS_BAR_CHAR, SESSION_STATS_BAR_MAX_WIDTH, SESSION_STATS_STATUS_ICON } from "./constants.js";
import {
	get_current_model,
	get_session_duration_label,
	get_sorted_tool_tallies,
	get_unique_models_used,
} from "./tracker.js";
import type { SessionStats } from "./types.js";

interface ShowSessionStatsPanelOptions {
	get_stats: () => SessionStats;
	shortcut_key: string;
	on_panel_open?: (close_panel: () => void) => void;
}

export async function show_session_stats_panel(
	ctx: { ui: { custom: (...args: any[]) => Promise<void> } },
	options: ShowSessionStatsPanelOptions,
): Promise<void> {
	await ctx.ui.custom(
		(tui: TUI, theme: Theme, _keybindings: unknown, done: () => void) => {
			const panel = new SessionStatsPanel(tui, theme, options, done);
			options.on_panel_open?.(() => done());
			return panel;
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "center" as const,
				width: 62,
				maxHeight: "70%",
			},
		},
	);
}

export class SessionStatsPanel {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly options: ShowSessionStatsPanelOptions;
	private readonly done: () => void;
	private stats: SessionStats;
	private scroll_offset = 0;
	private scroll_view_height = 0;
	private content_lines: string[] = [];

	constructor(tui: TUI, theme: Theme, options: ShowSessionStatsPanelOptions, done: () => void) {
		this.tui = tui;
		this.theme = theme;
		this.options = options;
		this.done = done;
		this.stats = options.get_stats();
	}

	handleInput(key_data: string): void {
		if (matchesKey(key_data, "ctrl+c") || matchesKey(key_data, "escape") || matchesKey(key_data, "q")) {
			this.done();
			return;
		}
		if (matchesKey(key_data, this.options.shortcut_key)) {
			this.done();
			return;
		}
		if (matchesKey(key_data, "r")) {
			this.refresh();
			return;
		}
		if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
			this.scroll(1);
			return;
		}
		if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
			this.scroll(-1);
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			this.scroll(this.scroll_view_height || 1);
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			this.scroll(-(this.scroll_view_height || 1));
			return;
		}
		if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
			this.scroll_offset = 0;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
			const max = Math.max(0, this.content_lines.length - this.scroll_view_height);
			this.scroll_offset = max;
			this.tui.requestRender();
			return;
		}
	}

	render(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;

		const max_h = this.get_max_height();
		const stats = this.stats;

		// ── build content ────────────────────────────────────
		const content: string[] = [];

		// title row
		const icon = t.fg("accent", SESSION_STATS_STATUS_ICON);
		const duration = get_session_duration_label(stats);
		const title = `${icon} ${t.fg("accent", t.bold("Session Stats"))}`;
		const dur_label = t.fg("dim", `duration ${duration}`);
		const gap = Math.max(1, iw - visibleWidth(title) - visibleWidth(dur_label));
		content.push(`${title}${" ".repeat(gap)}${dur_label}`);

		// divider
		content.push(t.fg("dim", "─".repeat(iw)));

		// summary row
		const summary_items = [
			`${t.fg("accent", `${stats.turn_count}`)} ${t.fg("muted", "turns")}`,
			`${t.fg("accent", `${stats.agent_loop_count}`)} ${t.fg("muted", "loops")}`,
			`${t.fg("accent", `${stats.compaction_count}`)} ${t.fg("muted", "compactions")}`,
		];
		content.push(`  ${summary_items.join("    ")}`);

		const activity_items = [
			`${t.fg("accent", `${stats.user_prompt_count}`)} ${t.fg("muted", "prompts")}`,
			`${t.fg("accent", `${stats.user_bash_count}`)} ${t.fg("muted", "user !cmds")}`,
		];
		content.push(`  ${activity_items.join("    ")}`);

		// divider + tool calls section
		content.push(t.fg("dim", "─".repeat(iw)));

		const sorted_tallies = get_sorted_tool_tallies(stats);

		if (sorted_tallies.length === 0) {
			content.push(`  ${t.fg("muted", "Tool Calls")}  ${t.fg("dim", "(none yet)")}`);
		} else {
			const error_label =
				stats.total_tool_errors > 0
					? `, ${t.fg("error", `${stats.total_tool_errors}`)} ${t.fg("muted", stats.total_tool_errors === 1 ? "error" : "errors")}`
					: "";
			content.push(
				`  ${t.fg("muted", "Tool Calls")}  ${t.fg("accent", `${stats.total_tool_calls}`)} ${t.fg("muted", "total")}${error_label}`,
			);
			content.push("");

			const max_calls = sorted_tallies[0][1].calls;
			const max_name_len = Math.max(...sorted_tallies.map(([name]) => name.length));

			for (const [name, tally] of sorted_tallies) {
				const bar_width =
					max_calls > 0 ? Math.max(1, Math.round((tally.calls / max_calls) * SESSION_STATS_BAR_MAX_WIDTH)) : 0;
				const bar = t.fg("accent", SESSION_STATS_BAR_CHAR.repeat(bar_width));
				const padded_name = t.fg("muted", name.padEnd(max_name_len));
				const count = `${tally.calls}`.padStart(4);

				let error_suffix = "";
				if (tally.errors > 0) {
					error_suffix = `  ${t.fg("error", `${tally.errors} err`)}`;
				}

				content.push(`  ${padded_name}  ${bar}  ${count}${error_suffix}`);
			}
		}

		// divider + models section
		content.push("");
		content.push(t.fg("dim", "─".repeat(iw)));

		const unique_models = get_unique_models_used(stats);
		const current_model = get_current_model(stats);

		if (unique_models.length === 0) {
			content.push(`  ${t.fg("muted", "Models")}  ${t.fg("dim", "(none recorded)")}`);
		} else {
			content.push(`  ${t.fg("muted", "Models")}`);
			for (const entry of unique_models) {
				const is_current = current_model && entry.model_id === current_model.model_id;
				const marker = is_current ? t.fg("accent", "▸") : " ";
				const label = `${entry.model_name} ${t.fg("dim", `(${entry.provider})`)}`;
				const suffix = is_current ? `  ${t.fg("dim", "— current")}` : "";
				content.push(`  ${marker} ${label}${suffix}`);
			}
		}

		this.content_lines = content;

		// ── footer ───────────────────────────────────────────
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const hints = [`${t.fg("accent", "esc")} close`, `${t.fg("accent", "r")} refresh`];
		if (this.content_lines.length > this.scroll_view_height && this.scroll_view_height > 0) {
			hints.push(`${t.fg("accent", "j/k")} scroll`);
			const start = this.scroll_offset + 1;
			const end = Math.min(this.content_lines.length, this.scroll_offset + this.scroll_view_height);
			hints.push(t.fg("dim", `${start}-${end}/${this.content_lines.length}`));
		}
		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── assemble with scrolling ──────────────────────────
		const footer_count = footer.length;
		const border_count = 2;
		this.scroll_view_height = Math.max(1, max_h - footer_count - border_count);

		const max_scroll = Math.max(0, this.content_lines.length - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));

		const visible = this.content_lines.slice(this.scroll_offset, this.scroll_offset + this.scroll_view_height);

		// pad to fill
		const fill = this.scroll_view_height - visible.length;
		for (let i = 0; i < fill; i++) {
			visible.push("");
		}

		const all_lines = [...visible, ...footer];
		return this.frame_content(all_lines, w, iw);
	}

	invalidate(): void {}

	// ── helpers ──────────────────────────────────────────────

	private refresh(): void {
		this.stats = this.options.get_stats();
		this.scroll_offset = 0;
		this.tui.requestRender();
	}

	private scroll(delta: number): void {
		const max = Math.max(0, this.content_lines.length - this.scroll_view_height);
		const new_offset = Math.max(0, Math.min(this.scroll_offset + delta, max));
		if (new_offset === this.scroll_offset) return;
		this.scroll_offset = new_offset;
		this.tui.requestRender();
	}

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

// ── layout helpers ──────────────────────────────────────────

function pad_to_width(value: string, width: number): string {
	const vis = visibleWidth(value);
	if (vis >= width) return truncateToWidth(value, width);
	return value + " ".repeat(width - vis);
}

export function build_plain_text_summary(stats: SessionStats): string {
	const lines: string[] = [];
	const duration = get_session_duration_label(stats);

	lines.push(`Session Stats (${duration})`);
	lines.push(`Turns: ${stats.turn_count}  Loops: ${stats.agent_loop_count}  Compactions: ${stats.compaction_count}`);
	lines.push(`Prompts: ${stats.user_prompt_count}  User !cmds: ${stats.user_bash_count}`);

	const sorted = get_sorted_tool_tallies(stats);
	if (sorted.length === 0) {
		lines.push("Tool calls: none");
	} else {
		lines.push(`Tool calls: ${stats.total_tool_calls} total, ${stats.total_tool_errors} errors`);
		for (const [name, tally] of sorted) {
			const err = tally.errors > 0 ? ` (${tally.errors} err)` : "";
			lines.push(`  ${name}: ${tally.calls}${err}`);
		}
	}

	const unique = get_unique_models_used(stats);
	if (unique.length > 0) {
		lines.push("Models:");
		const current = get_current_model(stats);
		for (const entry of unique) {
			const marker = current && entry.model_id === current.model_id ? "▸" : " ";
			lines.push(`  ${marker} ${entry.model_name} (${entry.provider})`);
		}
	}

	return lines.join("\n");
}
