import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import {
	SESSION_STATS_BAR_CHAR,
	SESSION_STATS_BAR_MAX_WIDTH,
	SESSION_STATS_PANEL_WIDTH,
	SESSION_STATS_STATUS_ICON,
} from "./constants.js";
import {
	get_current_model,
	get_session_duration_label,
	get_sorted_tool_tallies,
	get_unique_models_used,
	group_files_by_category,
} from "./tracker.js";
import type { FileCategory, FileTimelineEvent, SessionStats, ToolDetails, ToolTally } from "./types.js";

type PanelView = "list" | "detail";
type FileDetailMode = "categories" | "timeline";

const CATEGORY_ICONS: Record<FileCategory, string> = {
	docs: "◇",
	skills: "◆",
	tests: "△",
	code: "○",
};

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
				width: SESSION_STATS_PANEL_WIDTH,
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

	// View state
	private view: PanelView = "list";
	private selected_tool_index = 0;
	private scroll_offset = 0;
	private scroll_view_height = 0;
	private content_lines: string[] = [];
	private detail_scroll_offset = 0;
	private detail_lines: string[] = [];
	private detail_view_height = 0;
	private file_detail_mode: FileDetailMode = "categories";

	constructor(tui: TUI, theme: Theme, options: ShowSessionStatsPanelOptions, done: () => void) {
		this.tui = tui;
		this.theme = theme;
		this.options = options;
		this.done = done;
		this.stats = options.get_stats();
	}

	handleInput(key_data: string): void {
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

	// ── List view input ─────────────────────────────────────

	private handle_list_input(key_data: string): void {
		if (matchesKey(key_data, "escape") || matchesKey(key_data, "q")) {
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
		if (matchesKey(key_data, "enter") || matchesKey(key_data, "l") || matchesKey(key_data, "right")) {
			const tallies = get_sorted_tool_tallies(this.stats);
			if (tallies.length > 0) {
				this.open_detail_view();
			}
			return;
		}
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
			const tallies = get_sorted_tool_tallies(this.stats);
			this.set_selection(tallies.length - 1);
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

	// ── Detail view input ───────────────────────────────────

	private handle_detail_input(key_data: string): void {
		if (
			matchesKey(key_data, "escape") ||
			matchesKey(key_data, "q") ||
			matchesKey(key_data, "h") ||
			matchesKey(key_data, "left")
		) {
			this.view = "list";
			this.detail_scroll_offset = 0;
			this.tui.requestRender();
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
		// File detail mode switching (t = toggle, 1 = categories, 2 = timeline)
		if (this.has_timeline_mode()) {
			if (matchesKey(key_data, "t")) {
				this.file_detail_mode = this.file_detail_mode === "categories" ? "timeline" : "categories";
				this.detail_scroll_offset = 0;
				this.tui.requestRender();
				return;
			}
			if (matchesKey(key_data, "1")) {
				if (this.file_detail_mode !== "categories") {
					this.file_detail_mode = "categories";
					this.detail_scroll_offset = 0;
					this.tui.requestRender();
				}
				return;
			}
			if (matchesKey(key_data, "2")) {
				if (this.file_detail_mode !== "timeline") {
					this.file_detail_mode = "timeline";
					this.detail_scroll_offset = 0;
					this.tui.requestRender();
				}
				return;
			}
		}
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
	}

	// ── List view rendering ─────────────────────────────────

	private render_list_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const max_h = this.get_max_height();
		const stats = this.stats;

		const content: string[] = [];

		// ── header ───────────────────────────────────────────
		content.push("");
		const icon = t.fg("accent", SESSION_STATS_STATUS_ICON);
		const duration = get_session_duration_label(stats);
		const title = ` ${icon} ${t.fg("accent", t.bold("Session Stats"))}`;
		const dur_label = t.fg("dim", duration);
		const gap = Math.max(1, iw - visibleWidth(title) - visibleWidth(dur_label) - 1);
		content.push(`${title}${" ".repeat(gap)}${dur_label} `);
		content.push("");

		// ── summary ──────────────────────────────────────────
		const tools_used = stats.tool_tallies.size;
		const tools_avail = stats.available_tool_count;
		const tools_str =
			tools_avail > 0
				? `${t.fg("accent", `${tools_used}`)}${t.fg("dim", "/")}${t.fg("dim", `${tools_avail}`)} ${t.fg("muted", "tools")}`
				: "";

		const summary_line_1 = [
			`${t.fg("accent", `${stats.turn_count}`)} ${t.fg("muted", "turns")}`,
			`${t.fg("accent", `${stats.agent_loop_count}`)} ${t.fg("muted", "loops")}`,
			`${t.fg("accent", `${stats.compaction_count}`)} ${t.fg("muted", "compactions")}`,
			tools_str,
		]
			.filter(Boolean)
			.join(t.fg("dim", "   ·   "));
		content.push(`  ${summary_line_1}`);

		const summary_line_2 = [
			`${t.fg("accent", `${stats.user_prompt_count}`)} ${t.fg("muted", "prompts")}`,
			`${t.fg("accent", `${stats.user_bash_count}`)} ${t.fg("muted", "user !cmds")}`,
		].join(t.fg("dim", "   ·   "));
		content.push(`  ${summary_line_2}`);

		content.push("");

		// ── tool calls section ───────────────────────────────
		const sorted_tallies = get_sorted_tool_tallies(stats);
		const tool_count = sorted_tallies.length;

		if (tool_count > 0) {
			this.selected_tool_index = Math.max(0, Math.min(this.selected_tool_index, tool_count - 1));
		}

		const error_str =
			stats.total_tool_errors > 0
				? `  ${t.fg("error", `${stats.total_tool_errors}`)} ${t.fg("muted", stats.total_tool_errors === 1 ? "error" : "errors")}`
				: "";
		const section_right =
			sorted_tallies.length > 0
				? `${t.fg("dim", `${stats.total_tool_calls} total`)}${error_str} `
				: `${t.fg("dim", "none yet")} `;
		content.push(this.section_header("Tool Calls", section_right, iw));
		content.push("");

		if (sorted_tallies.length > 0) {
			const max_calls = sorted_tallies[0][1].calls;
			const max_name_len = Math.max(...sorted_tallies.map(([name]) => name.length));

			for (let i = 0; i < sorted_tallies.length; i++) {
				const [name, tally] = sorted_tallies[i];
				const is_selected = i === this.selected_tool_index;

				const marker = is_selected ? t.fg("accent", " ▸") : "  ";
				const bar_width =
					max_calls > 0 ? Math.max(1, Math.round((tally.calls / max_calls) * SESSION_STATS_BAR_MAX_WIDTH)) : 0;
				const bar_color = is_selected ? "accent" : "dim";
				const bar = t.fg(bar_color, SESSION_STATS_BAR_CHAR.repeat(bar_width));
				const tool_name = is_selected
					? t.fg("accent", t.bold(name.padEnd(max_name_len)))
					: t.fg("muted", name.padEnd(max_name_len));
				const count = `${tally.calls}`.padStart(4);
				const count_str = is_selected ? t.fg("accent", count) : count;

				let err_suffix = "";
				if (tally.errors > 0) {
					err_suffix = `  ${t.fg("error", `${tally.errors} err`)}`;
				}

				content.push(`${marker} ${tool_name}  ${bar}  ${count_str}${err_suffix}`);
			}
		}

		content.push("");

		// ── models section ───────────────────────────────────
		const unique_models = get_unique_models_used(stats);
		const current_model = get_current_model(stats);

		content.push(this.section_header("Models", unique_models.length === 0 ? `${t.fg("dim", "none")} ` : "", iw));

		if (unique_models.length > 0) {
			content.push("");
			for (const entry of unique_models) {
				const is_current = current_model && entry.model_id === current_model.model_id;
				const m_marker = is_current ? t.fg("accent", "▸") : " ";
				const label = is_current
					? `${t.fg("accent", entry.model_name)} ${t.fg("dim", `(${entry.provider})`)}`
					: `${entry.model_name} ${t.fg("dim", `(${entry.provider})`)}`;
				const suffix = is_current ? `  ${t.fg("dim", "current")}` : "";
				content.push(`   ${m_marker} ${label}${suffix}`);
			}
		}

		content.push("");

		this.content_lines = content;

		// ── footer ───────────────────────────────────────────
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const hints: string[] = [`${t.fg("accent", "esc")} close`, `${t.fg("accent", "r")} refresh`];
		if (tool_count > 0) {
			hints.push(`${t.fg("accent", "j/k")} select`);
			hints.push(`${t.fg("accent", "enter")} detail`);
		}
		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── assemble with scrolling ──────────────────────────
		const footer_count = footer.length;
		const border_count = 2;
		this.scroll_view_height = Math.max(1, max_h - footer_count - border_count);

		this.ensure_selection_visible(sorted_tallies);

		const max_scroll = Math.max(0, this.content_lines.length - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));

		const visible = this.content_lines.slice(this.scroll_offset, this.scroll_offset + this.scroll_view_height);

		const fill = this.scroll_view_height - visible.length;
		for (let i = 0; i < fill; i++) {
			visible.push("");
		}

		const all_lines = [...visible, ...footer];
		return this.frame_content(all_lines, w, iw);
	}

	// ── Detail view rendering ───────────────────────────────

	private render_detail_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const max_h = this.get_max_height();

		const sorted_tallies = get_sorted_tool_tallies(this.stats);
		if (sorted_tallies.length === 0) {
			this.view = "list";
			return this.render_list_view(width);
		}

		const [tool_name, tally] = sorted_tallies[this.selected_tool_index];

		// ── header ───────────────────────────────────────────
		const header: string[] = [];
		header.push("");

		const icon = t.fg("accent", SESSION_STATS_STATUS_ICON);
		const breadcrumb = ` ${icon} ${t.fg("dim", "Session Stats")} ${t.fg("dim", "›")} ${t.fg("accent", t.bold(tool_name))}`;
		const count_badge = `${t.fg("accent", `${tally.calls}`)} ${t.fg("dim", tally.calls === 1 ? "call" : "calls")} `;
		const gap = Math.max(1, iw - visibleWidth(breadcrumb) - visibleWidth(count_badge));
		header.push(`${breadcrumb}${" ".repeat(gap)}${count_badge}`);

		header.push("");
		header.push(t.fg("dim", "─".repeat(iw)));

		// ── detail content ───────────────────────────────────
		const detail_content = this.build_detail_content(tool_name, this.stats.tool_details, iw);
		this.detail_lines = detail_content;

		// ── footer ───────────────────────────────────────────
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const hints: string[] = [`${t.fg("accent", "esc")} back`, `${t.fg("accent", "r")} refresh`];
		if (this.detail_lines.length > 5) {
			hints.push(`${t.fg("accent", "j/k")} scroll`);
		}
		if (this.has_timeline_mode()) {
			hints.push(`${t.fg("accent", "t")} mode`);
		}
		if (this.detail_lines.length > this.detail_view_height && this.detail_view_height > 0) {
			const start = this.detail_scroll_offset + 1;
			const end = Math.min(this.detail_lines.length, this.detail_scroll_offset + this.detail_view_height);
			hints.push(t.fg("dim", `${start}–${end}/${this.detail_lines.length}`));
		}
		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── assemble with scrolling ──────────────────────────
		const footer_count = footer.length;
		const header_count = header.length;
		const border_count = 2;
		this.detail_view_height = Math.max(1, max_h - header_count - footer_count - border_count);

		const max_scroll = Math.max(0, this.detail_lines.length - this.detail_view_height);
		this.detail_scroll_offset = Math.max(0, Math.min(this.detail_scroll_offset, max_scroll));

		const visible = this.detail_lines.slice(
			this.detail_scroll_offset,
			this.detail_scroll_offset + this.detail_view_height,
		);

		const fill = this.detail_view_height - visible.length;
		for (let i = 0; i < fill; i++) {
			visible.push("");
		}

		const all_lines = [...header, ...visible, ...footer];
		return this.frame_content(all_lines, w, iw);
	}

	// ── Detail content builders ─────────────────────────────

	private build_detail_content(tool_name: string, details: ToolDetails, iw: number): string[] {
		const name_lower = tool_name.toLowerCase();
		switch (name_lower) {
			case "bash":
				return this.detail_bash(details, iw);
			case "read":
				return this.detail_file_tool("Files Read", details.read_files, details.read_timeline_events, iw);
			case "edit":
				return this.detail_file_tool("Files Edited", details.edit_files, details.edit_timeline_events, iw);
			case "write":
				return this.detail_file_tool("Files Written", details.write_files, details.write_timeline_events, iw);
			case "expertise":
				return this.detail_expertise(details, iw);
			case "todo":
				return this.detail_todo(details, iw);
			default:
				return this.detail_generic(tool_name);
		}
	}

	private detail_bash(details: ToolDetails, iw: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		const programs = Array.from(details.bash_programs.entries()).sort((a, b) => b[1] - a[1]);

		lines.push("");
		lines.push(`  ${t.fg("muted", "CLI Programs")} ${t.fg("dim", `(${programs.length})`)}`);
		lines.push("");

		if (programs.length === 0) {
			lines.push(`  ${t.fg("dim", "No commands parsed.")}`);
			return lines;
		}

		const max_count = programs[0][1];
		const max_name_len = Math.max(...programs.map(([name]) => name.length));
		const bar_max = Math.min(SESSION_STATS_BAR_MAX_WIDTH, iw - max_name_len - 14);

		for (const [name, count] of programs) {
			const bar_width = max_count > 0 ? Math.max(1, Math.round((count / max_count) * Math.max(1, bar_max))) : 0;
			const bar = t.fg("accent", SESSION_STATS_BAR_CHAR.repeat(bar_width));
			const padded_name = t.fg("muted", name.padEnd(max_name_len));
			const count_str = `${count}`.padStart(4);
			lines.push(`    ${padded_name}  ${bar}  ${count_str}`);
		}

		lines.push("");
		return lines;
	}

	/**
	 * Shared detail renderer for file-operation tools (Read, Edit, Write).
	 * Shows a mode switch between categories (grouped unique files) and timeline.
	 */
	private detail_file_tool(
		title: string,
		unique_files: string[],
		timeline_events: FileTimelineEvent[],
		iw: number,
	): string[] {
		const t = this.theme;
		const lines: string[] = [];

		// ── mode switch indicator ────────────────────────────
		lines.push("");
		const cat_label =
			this.file_detail_mode === "categories" ? t.fg("accent", t.bold("Categories")) : t.fg("dim", "Categories");
		const tl_label =
			this.file_detail_mode === "timeline" ? t.fg("accent", t.bold("Timeline")) : t.fg("dim", "Timeline");
		lines.push(`  ${t.fg("muted", "Mode:")} ${cat_label}  ${tl_label}  ${t.fg("dim", "(t toggle · 1/2)")}`);
		lines.push("");

		if (unique_files.length === 0 && timeline_events.length === 0) {
			lines.push(`  ${t.fg("dim", "None.")}`);
			return lines;
		}

		if (this.file_detail_mode === "timeline") {
			return [...lines, ...this.render_file_timeline(title, timeline_events, iw)];
		}

		return [...lines, ...this.render_file_categories(title, unique_files, iw)];
	}

	private render_file_categories(title: string, files: string[], iw: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		const total = files.length;

		lines.push(`  ${t.fg("muted", title)} ${t.fg("dim", `(${total})`)}`);
		lines.push("");

		const grouped = group_files_by_category(files);
		const category_order: FileCategory[] = ["docs", "skills", "tests", "code"];

		for (const cat of category_order) {
			const cat_files = grouped.get(cat);
			if (!cat_files || cat_files.length === 0) continue;

			const icon = t.fg("dim", CATEGORY_ICONS[cat]);
			const label = t.fg("muted", cat.charAt(0).toUpperCase() + cat.slice(1));
			lines.push(`  ${icon} ${label} ${t.fg("dim", `(${cat_files.length})`)}`);

			for (const file of cat_files) {
				const display_path = truncateToWidth(file, iw - 8);
				lines.push(`    ${t.fg("dim", "│")} ${display_path}`);
			}
			lines.push("");
		}

		return lines;
	}

	private render_file_timeline(title: string, events: FileTimelineEvent[], iw: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		const op_count = events.filter((e) => e.kind === "file-op").length;

		lines.push(`  ${t.fg("muted", title)} ${t.fg("dim", `(${op_count})`)}`);
		lines.push("");

		if (events.length === 0) {
			lines.push(`  ${t.fg("dim", "No events yet.")}`);
			return lines;
		}

		// Compute max order digits for padding
		const max_order = events.reduce((max, e) => (e.kind === "file-op" && e.op_order > max ? e.op_order : max), 0);
		const order_width = Math.max(2, `${max_order}`.length);
		// Max path width: iw - indent(4) - time(8+2) - order(order_width+1) - icon(2) - repeat(3) - padding
		const max_path_width = Math.max(20, iw - 4 - 10 - order_width - 1 - 2 - 3 - 2);

		for (const event of events) {
			if (event.kind === "user-marker") {
				const time_str = format_timestamp_local(event.timestamp);
				lines.push("");
				lines.push(`  ${t.fg("dim", time_str)}  ${t.fg("muted", "●")} ${t.fg("muted", "user message")}`);
				lines.push("");
			} else {
				const time_str = format_timestamp_local(event.timestamp);
				const order_str = `${event.op_order}`.padStart(order_width, "0");
				const icon = CATEGORY_ICONS[event.category] || "·";
				const repeat_marker = event.is_repeat ? ` ${t.fg("dim", "↺")}` : "";
				const display_path = truncateToWidth(event.path, max_path_width);
				lines.push(
					`  ${t.fg("dim", time_str)}  ${t.fg("accent", order_str)} ${t.fg("dim", icon)} ${display_path}${repeat_marker}`,
				);
			}
		}

		// ── legend ───────────────────────────────────────────
		lines.push("");
		lines.push(`  ${t.fg("dim", "◇ docs  ◆ skills  △ tests  ○ code  ↺ repeat")}`);

		return lines;
	}

	private detail_expertise(details: ToolDetails, _iw: number): string[] {
		const t = this.theme;
		const lines: string[] = [];

		lines.push("");
		lines.push(`  ${t.fg("muted", "Expertise Actions")}`);
		lines.push("");

		if (details.expertise_actions.size === 0) {
			lines.push(`  ${t.fg("dim", "No expertise calls.")}`);
			return lines;
		}

		for (const [action, domains] of details.expertise_actions.entries()) {
			lines.push(`  ${t.fg("accent", action)}`);
			for (const domain of domains) {
				lines.push(`    ${t.fg("dim", "│")} ${domain}`);
			}
			lines.push("");
		}

		return lines;
	}

	private detail_todo(details: ToolDetails, _iw: number): string[] {
		const t = this.theme;
		const lines: string[] = [];

		lines.push("");
		lines.push(`  ${t.fg("muted", "Todo Actions")}`);
		lines.push("");

		if (details.todo_actions.size === 0) {
			lines.push(`  ${t.fg("dim", "No todo calls.")}`);
			return lines;
		}

		const sorted = Array.from(details.todo_actions.entries()).sort((a, b) => b[1] - a[1]);
		for (const [action, count] of sorted) {
			lines.push(`    ${t.fg("muted", action)}  ${t.fg("accent", `${count}`)}`);
		}

		lines.push("");
		return lines;
	}

	private detail_generic(tool_name: string): string[] {
		const t = this.theme;
		return ["", `  ${t.fg("dim", `No detail view available for ${tool_name}.`)}`, ""];
	}

	// ── Helpers ──────────────────────────────────────────────

	/** Tools that support the categories/timeline mode toggle. */
	private has_timeline_mode(): boolean {
		const name = this.get_selected_tool_name();
		return name === "read" || name === "edit" || name === "write";
	}

	private get_selected_tool_name(): string | null {
		const sorted_tallies = get_sorted_tool_tallies(this.stats);
		if (sorted_tallies.length === 0) return null;
		return sorted_tallies[this.selected_tool_index][0].toLowerCase();
	}

	private section_header(label: string, right_text: string, iw: number): string {
		const t = this.theme;
		const left = `${t.fg("dim", "──")} ${t.fg("muted", label)} `;
		const right = right_text ? `${right_text}${t.fg("dim", "──")}` : "";
		const left_vis = visibleWidth(left);
		const right_vis = visibleWidth(right);
		const fill = Math.max(0, iw - left_vis - right_vis);
		return `${left}${t.fg("dim", "─".repeat(fill))}${right}`;
	}

	private refresh(): void {
		this.stats = this.options.get_stats();
		this.scroll_offset = 0;
		this.detail_scroll_offset = 0;
		this.tui.requestRender();
	}

	private move_selection(delta: number): void {
		const tallies = get_sorted_tool_tallies(this.stats);
		if (tallies.length === 0) return;
		const new_idx = Math.max(0, Math.min(this.selected_tool_index + delta, tallies.length - 1));
		if (new_idx === this.selected_tool_index) return;
		this.selected_tool_index = new_idx;
		this.tui.requestRender();
	}

	private set_selection(index: number): void {
		const tallies = get_sorted_tool_tallies(this.stats);
		if (tallies.length === 0) return;
		const new_idx = Math.max(0, Math.min(index, tallies.length - 1));
		if (new_idx === this.selected_tool_index) return;
		this.selected_tool_index = new_idx;
		this.tui.requestRender();
	}

	private ensure_selection_visible(sorted_tallies: Array<[string, ToolTally]>): void {
		// Find the content line index for the selected tool row
		// Tool rows start after the header lines — just ensure scroll doesn't hide it
		if (sorted_tallies.length === 0) return;
		// The tool rows are near the middle of content, auto-scroll not needed for typical panels
		// but ensure scroll stays in bounds
		const max_scroll = Math.max(0, this.content_lines.length - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));
	}

	private open_detail_view(): void {
		this.view = "detail";
		this.detail_scroll_offset = 0;
		this.file_detail_mode = "categories";
		this.tui.requestRender();
	}

	private scroll_detail(delta: number): void {
		const max_scroll = Math.max(0, this.detail_lines.length - this.detail_view_height);
		const new_offset = Math.max(0, Math.min(this.detail_scroll_offset + delta, max_scroll));
		if (new_offset === this.detail_scroll_offset) return;
		this.detail_scroll_offset = new_offset;
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

function format_timestamp_local(timestamp: string): string {
	try {
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return "--:--:--";
		const h = `${date.getHours()}`.padStart(2, "0");
		const m = `${date.getMinutes()}`.padStart(2, "0");
		const s = `${date.getSeconds()}`.padStart(2, "0");
		return `${h}:${m}:${s}`;
	} catch {
		return "--:--:--";
	}
}

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

	if (stats.available_tool_count > 0) {
		lines.push(`Tools: ${stats.tool_tallies.size}/${stats.available_tool_count} used`);
	}

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

	// Tool details in plain text
	const details = stats.tool_details;

	if (details.bash_programs.size > 0) {
		const programs = Array.from(details.bash_programs.entries()).sort((a, b) => b[1] - a[1]);
		lines.push("Bash programs:");
		for (const [prog, count] of programs) {
			lines.push(`  ${prog}: ${count}`);
		}
	}

	if (details.read_files.length > 0) {
		lines.push(`Files read (${details.read_files.length}):`);
		for (const f of [...details.read_files].sort()) {
			lines.push(`  ${f}`);
		}
	}

	append_plain_text_timeline(lines, "Read", "reads", details.read_timeline_events);

	if (details.edit_files.length > 0) {
		lines.push(`Files edited (${details.edit_files.length}):`);
		for (const f of [...details.edit_files].sort()) {
			lines.push(`  ${f}`);
		}
	}

	append_plain_text_timeline(lines, "Edit", "edits", details.edit_timeline_events);

	if (details.write_files.length > 0) {
		lines.push(`Files written (${details.write_files.length}):`);
		for (const f of [...details.write_files].sort()) {
			lines.push(`  ${f}`);
		}
	}

	append_plain_text_timeline(lines, "Write", "writes", details.write_timeline_events);

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

const PLAIN_TEXT_TIMELINE_MAX_DISPLAY = 20;

function append_plain_text_timeline(lines: string[], label: string, noun: string, events: FileTimelineEvent[]): void {
	if (events.length === 0) return;
	const ops = events.filter((e) => e.kind === "file-op");
	if (ops.length === 0) return;

	lines.push(`${label} timeline (${ops.length} ${noun}):`);
	let shown = 0;
	for (const event of events) {
		if (shown >= PLAIN_TEXT_TIMELINE_MAX_DISPLAY) break;
		if (event.kind === "user-marker") {
			lines.push(`  ● user message #${event.user_message_index}`);
		} else {
			const order = `${event.op_order}`.padStart(2, "0");
			lines.push(`  ${order} ${event.path}${event.is_repeat ? " ↺" : ""}`);
		}
		shown += 1;
	}
	if (events.length > PLAIN_TEXT_TIMELINE_MAX_DISPLAY) {
		lines.push(`  ... (+${events.length - PLAIN_TEXT_TIMELINE_MAX_DISPLAY} more)`);
	}
}
