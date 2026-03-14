import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { QMD_PANEL_ICON, QMD_PANEL_SHORTCUT, QMD_PANEL_WIDTH } from "./constants.js";
import type { FileTreeNode, FlatTreeEntry, QmdPanelSnapshot } from "./data.js";
import { build_file_tree, collect_file_paths, flatten_tree, format_relative_time } from "./data.js";
import { ToggleState } from "./toggle-state.js";

type PanelView = "overview" | "files" | "updating" | "applying";

export interface QmdPanelCallbacks {
	get_snapshot: () => Promise<QmdPanelSnapshot>;
	on_update: () => Promise<void>;
	on_init: () => void;
	on_close: () => void;
	on_toggle_files: (adds: string[], removes: string[]) => Promise<void>;
}

export async function show_qmd_panel(
	ctx: { ui: { custom: (...args: unknown[]) => Promise<void> } },
	callbacks: QmdPanelCallbacks,
	initial_snapshot: QmdPanelSnapshot,
): Promise<void> {
	await ctx.ui.custom(
		(tui: TUI, theme: Theme, _keybindings: unknown, done: () => void) => {
			const panel = new QmdPanel(tui, theme, callbacks, done, initial_snapshot);
			callbacks.on_close = () => done();
			return panel;
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "center" as const,
				width: QMD_PANEL_WIDTH,
				maxHeight: "70%",
			},
		},
	);
}

export class QmdPanel {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly callbacks: QmdPanelCallbacks;
	private readonly done: () => void;
	private snapshot: QmdPanelSnapshot;

	// View state
	private view: PanelView = "overview";
	private scroll_offset = 0;
	private scroll_view_height = 0;
	private content_lines: string[] = [];
	private updating = false;
	private update_progress: string | null = null;

	// Tree view state
	private tree_roots: FileTreeNode[] = [];
	private tree_collapsed: Set<string> = new Set();
	private tree_flat: FlatTreeEntry[] = [];
	private tree_cursor = 0;
	private tree_scroll_offset = 0;
	private tree_view_height = 0;

	// Toggle state — tracks pending index changes
	private toggle: ToggleState = new ToggleState([]);

	constructor(
		tui: TUI,
		theme: Theme,
		callbacks: QmdPanelCallbacks,
		done: () => void,
		initial_snapshot: QmdPanelSnapshot,
	) {
		this.tui = tui;
		this.theme = theme;
		this.callbacks = callbacks;
		this.done = done;
		this.snapshot = initial_snapshot;
	}

	handleInput(key_data: string): void {
		if (matchesKey(key_data, "ctrl+c")) {
			this.done();
			return;
		}

		if (matchesKey(key_data, QMD_PANEL_SHORTCUT)) {
			this.done();
			return;
		}

		if (this.view === "files") {
			this.handle_files_input(key_data);
		} else if (this.view === "updating") {
			this.handle_updating_input(key_data);
		} else {
			this.handle_overview_input(key_data);
		}
	}

	render(width: number): string[] {
		if (this.view === "files") {
			return this.render_files_view(width);
		}
		if (this.view === "updating" || this.view === "applying") {
			return this.render_updating_view(width);
		}
		return this.render_overview(width);
	}

	invalidate(): void {}

	// ── Overview input ──────────────────────────────────────

	private handle_overview_input(key_data: string): void {
		if (matchesKey(key_data, "escape") || matchesKey(key_data, "q")) {
			this.done();
			return;
		}
		if (matchesKey(key_data, "r")) {
			this.refresh();
			return;
		}
		if (matchesKey(key_data, "u") && this.snapshot.binding_status === "indexed") {
			this.start_update();
			return;
		}
		if (matchesKey(key_data, "i") && this.snapshot.binding_status === "not_indexed") {
			this.done();
			this.callbacks.on_init();
			return;
		}
		if (
			(matchesKey(key_data, "enter") || matchesKey(key_data, "l") || matchesKey(key_data, "right")) &&
			this.snapshot.binding_status === "indexed" &&
			this.snapshot.filesystem_paths.length > 0
		) {
			this.open_tree_view();
			return;
		}
		this.handle_scroll_input(key_data);
	}

	// ── Files (tree) input ──────────────────────────────────

	private handle_files_input(key_data: string): void {
		if (
			matchesKey(key_data, "escape") ||
			matchesKey(key_data, "q") ||
			matchesKey(key_data, "h") ||
			matchesKey(key_data, "left")
		) {
			this.toggle.clear();
			this.view = "overview";
			this.scroll_offset = 0;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "r")) {
			this.refresh();
			return;
		}
		// enter / l / right → expand/collapse dirs
		if (matchesKey(key_data, "enter") || matchesKey(key_data, "l") || matchesKey(key_data, "right")) {
			this.tree_toggle_expand();
			return;
		}
		// space → toggle file/dir index inclusion
		if (matchesKey(key_data, "space")) {
			this.tree_toggle_inclusion();
			return;
		}
		// a → apply pending changes
		if (matchesKey(key_data, "a")) {
			if (this.toggle.has_pending()) {
				this.apply_pending_changes();
			}
			return;
		}
		if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
			this.tree_move_cursor(1);
			return;
		}
		if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
			this.tree_move_cursor(-1);
			return;
		}
		if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
			this.tree_set_cursor(0);
			return;
		}
		if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
			this.tree_set_cursor(this.tree_flat.length - 1);
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			this.tree_move_cursor(this.tree_view_height || 1);
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			this.tree_move_cursor(-(this.tree_view_height || 1));
			return;
		}
	}

	// ── Updating input ──────────────────────────────────────

	private handle_updating_input(key_data: string): void {
		if (matchesKey(key_data, "escape")) {
			this.done();
		}
	}

	// ── Overview scroll handling ────────────────────────────

	private handle_scroll_input(key_data: string): void {
		const max_scroll = Math.max(0, this.content_lines.length - this.scroll_view_height);

		if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
			const n = Math.min(this.scroll_offset + 1, max_scroll);
			if (n !== this.scroll_offset) {
				this.scroll_offset = n;
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
			const n = Math.max(this.scroll_offset - 1, 0);
			if (n !== this.scroll_offset) {
				this.scroll_offset = n;
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
			this.scroll_offset = 0;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
			this.scroll_offset = max_scroll;
			this.tui.requestRender();
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			const n = Math.min(this.scroll_offset + (this.scroll_view_height || 1), max_scroll);
			if (n !== this.scroll_offset) {
				this.scroll_offset = n;
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			const n = Math.max(this.scroll_offset - (this.scroll_view_height || 1), 0);
			if (n !== this.scroll_offset) {
				this.scroll_offset = n;
				this.tui.requestRender();
			}
		}
	}

	// ── Tree navigation helpers ─────────────────────────────

	private open_tree_view(): void {
		this.toggle = new ToggleState(this.snapshot.indexed_paths);
		this.tree_roots = build_file_tree(this.snapshot.filesystem_paths, this.toggle.indexed_set);
		this.tree_collapsed = new Set();
		// Start with top-level dirs collapsed for easy navigation
		for (const root of this.tree_roots) {
			if (root.is_dir) {
				this.tree_collapsed.add(root.path);
			}
		}
		this.tree_flat = flatten_tree(this.tree_roots, this.tree_collapsed);
		this.tree_cursor = 0;
		this.tree_scroll_offset = 0;
		this.view = "files";
		this.tui.requestRender();
	}

	private rebuild_tree_flat(): void {
		this.tree_flat = flatten_tree(this.tree_roots, this.tree_collapsed);
		// Clamp cursor
		if (this.tree_cursor >= this.tree_flat.length) {
			this.tree_cursor = Math.max(0, this.tree_flat.length - 1);
		}
	}

	/** Expand/collapse a directory node */
	private tree_toggle_expand(): void {
		if (this.tree_flat.length === 0) return;
		const entry = this.tree_flat[this.tree_cursor];
		if (!entry.node.is_dir) return;

		if (this.tree_collapsed.has(entry.node.path)) {
			this.tree_collapsed.delete(entry.node.path);
		} else {
			this.tree_collapsed.add(entry.node.path);
		}
		this.rebuild_tree_flat();
		this.tui.requestRender();
	}

	/** Toggle index inclusion for the current file or all files in a dir */
	private tree_toggle_inclusion(): void {
		if (this.tree_flat.length === 0) return;
		const entry = this.tree_flat[this.tree_cursor];
		this.toggle.toggle_node(entry.node);
		this.tui.requestRender();
	}

	/** Apply pending adds/removes via SDK callbacks */
	private async apply_pending_changes(): Promise<void> {
		if (this.updating) return;
		const adds = [...this.toggle.pending_adds];
		const removes = [...this.toggle.pending_removes];
		if (adds.length === 0 && removes.length === 0) return;

		this.updating = true;
		this.view = "applying";
		this.update_progress = `${removes.length} to remove, ${adds.length} to add…`;
		this.tui.requestRender();

		try {
			await this.callbacks.on_toggle_files(adds, removes);
			this.snapshot = await this.callbacks.get_snapshot();
			// Re-open tree view with fresh data
			this.toggle = new ToggleState(this.snapshot.indexed_paths);
			this.tree_roots = build_file_tree(this.snapshot.filesystem_paths, this.toggle.indexed_set);
			this.rebuild_tree_flat();
			this.view = "files";
		} catch {
			this.view = "files";
		} finally {
			this.updating = false;
			this.update_progress = null;
			this.tui.requestRender();
		}
	}

	private tree_move_cursor(delta: number): void {
		if (this.tree_flat.length === 0) return;
		const new_idx = Math.max(0, Math.min(this.tree_cursor + delta, this.tree_flat.length - 1));
		if (new_idx === this.tree_cursor) return;
		this.tree_cursor = new_idx;
		this.tui.requestRender();
	}

	private tree_set_cursor(idx: number): void {
		if (this.tree_flat.length === 0) return;
		const clamped = Math.max(0, Math.min(idx, this.tree_flat.length - 1));
		if (clamped === this.tree_cursor) return;
		this.tree_cursor = clamped;
		this.tui.requestRender();
	}

	private ensure_cursor_visible(): void {
		if (this.tree_cursor < this.tree_scroll_offset) {
			this.tree_scroll_offset = this.tree_cursor;
		} else if (this.tree_cursor >= this.tree_scroll_offset + this.tree_view_height) {
			this.tree_scroll_offset = this.tree_cursor - this.tree_view_height + 1;
		}
		const max_scroll = Math.max(0, this.tree_flat.length - this.tree_view_height);
		this.tree_scroll_offset = Math.max(0, Math.min(this.tree_scroll_offset, max_scroll));
	}

	// ── Overview rendering ──────────────────────────────────

	private render_overview(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const max_h = this.get_max_height();
		const snap = this.snapshot;

		const content: string[] = [];
		content.push("");

		// ── header ───────────────────────────────────────────
		const icon = t.fg("accent", QMD_PANEL_ICON);
		const title = ` ${icon} ${t.fg("accent", t.bold("QMD Index"))}`;
		const badge = this.status_badge(snap);
		const gap = Math.max(1, iw - visibleWidth(title) - visibleWidth(badge) - 1);
		content.push(`${title}${" ".repeat(gap)}${badge} `);
		content.push("");

		if (snap.binding_status === "unavailable") {
			if (snap.error_reason) {
				content.push(`  ${t.fg("error", snap.error_reason)}`);
			}
			content.push("");
		} else if (snap.binding_status === "not_indexed") {
			if (snap.repo_root) {
				content.push(`  ${snap.repo_root}`);
			}
			content.push("");
			content.push(`  ${t.fg("muted", "Run /qmd init to onboard this repository.")}`);
			content.push("");
		} else {
			this.render_indexed_overview(content, snap, iw);
		}

		this.content_lines = content;

		// ── footer ───────────────────────────────────────────
		const footer = this.overview_footer(snap, iw);

		const footer_count = footer.length;
		const border_count = 2;
		this.scroll_view_height = Math.max(1, max_h - footer_count - border_count);

		const max_scroll = Math.max(0, this.content_lines.length - this.scroll_view_height);
		this.scroll_offset = Math.max(0, Math.min(this.scroll_offset, max_scroll));

		const visible = this.content_lines.slice(this.scroll_offset, this.scroll_offset + this.scroll_view_height);
		const fill = this.scroll_view_height - visible.length;
		for (let i = 0; i < fill; i++) {
			visible.push("");
		}

		return this.frame_content([...visible, ...footer], w, iw);
	}

	private render_indexed_overview(content: string[], snap: QmdPanelSnapshot, iw: number): void {
		const t = this.theme;

		// ── summary line ─────────────────────────────────────
		const freshness_tag =
			snap.freshness_status === "fresh"
				? t.fg("accent", "fresh ✓")
				: snap.freshness_status === "stale"
					? t.fg("warning", `${snap.stale_count} stale`)
					: t.fg("dim", "freshness ?");

		const summary_parts = [
			snap.collection_key ? t.fg("accent", snap.collection_key) : null,
			snap.glob_pattern ? t.fg("dim", snap.glob_pattern) : null,
			`${t.fg("accent", `${snap.total_documents}`)} ${t.fg("muted", "docs")}`,
			freshness_tag,
		].filter(Boolean);
		content.push(`  ${summary_parts.join(t.fg("dim", "  ·  "))}`);

		// ── timestamp line ───────────────────────────────────
		if (snap.last_indexed_at) {
			const time_parts = [
				`${t.fg("muted", "last indexed:")} ${t.fg("dim", format_relative_time(snap.last_indexed_at))}`,
			];
			if (snap.last_indexed_commit) {
				time_parts.push(t.fg("dim", snap.last_indexed_commit.slice(0, 7)));
			}
			content.push(`  ${time_parts.join(t.fg("dim", "  ·  "))}`);
		}

		content.push("");

		// ── index section ────────────────────────────────────
		const embed_right =
			snap.needs_embedding > 0
				? `${t.fg("warning", `${snap.needs_embedding}`)} ${t.fg("muted", "pending embed")} `
				: `${t.fg("dim", "0 pending embed")} `;
		content.push(this.section_header("Index", embed_right, iw));
		content.push("");
		content.push(`    ${t.fg("muted", "documents")}${" ".repeat(6)}${snap.total_documents}`);
		content.push(`    ${t.fg("muted", "vector index")}${" ".repeat(3)}${snap.has_vector_index ? "✓" : "✗"}`);
		content.push(`    ${t.fg("muted", "needs embed")}${" ".repeat(4)}${snap.needs_embedding}`);
		content.push("");

		// ── contexts section ─────────────────────────────────
		if (snap.contexts.length > 0) {
			content.push(this.section_header(`Contexts (${snap.contexts.length})`, "", iw));
			content.push("");
			for (const ctx of snap.contexts) {
				const path_str = t.fg("accent", ctx.path.padEnd(16));
				const ann = truncateToWidth(ctx.annotation, iw - 22);
				content.push(`  ${path_str}${t.fg("dim", ann)}`);
			}
			content.push("");
		}

		// ── stale section ────────────────────────────────────
		if (snap.stale_count > 0) {
			const stale_right = `${t.fg("accent", "u")} ${t.fg("muted", "to update")} `;
			content.push(this.section_header(`Stale (${snap.stale_count})`, stale_right, iw));
			content.push("");
			const max_show = 15;
			const shown = snap.stale_paths.slice(0, max_show);
			for (const p of shown) {
				content.push(`    ${truncateToWidth(p, iw - 6)}`);
			}
			if (snap.stale_paths.length > max_show) {
				content.push(`    ${t.fg("dim", `… +${snap.stale_paths.length - max_show} more`)}`);
			}
			content.push("");
		}
	}

	// ── Files (tree) view rendering ─────────────────────────

	private render_files_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const max_h = this.get_max_height();
		const snap = this.snapshot;

		const pending_count = this.toggle.pending_count();

		// ── header ───────────────────────────────────────────
		const header: string[] = [];
		header.push("");
		const icon = t.fg("accent", QMD_PANEL_ICON);
		const breadcrumb = ` ${icon} ${t.fg("dim", "QMD Index")} ${t.fg("dim", "›")} ${t.fg("accent", t.bold("Files"))}`;
		const indexed_count = snap.indexed_paths.length;
		const total_count = snap.filesystem_paths.length;
		const count_badge = `${t.fg("accent", `${indexed_count}`)}${t.fg("dim", "/")}${t.fg("muted", `${total_count}`)} ${t.fg("dim", "indexed")} `;
		const hgap = Math.max(1, iw - visibleWidth(breadcrumb) - visibleWidth(count_badge));
		header.push(`${breadcrumb}${" ".repeat(hgap)}${count_badge}`);
		if (pending_count > 0) {
			const pending_text = `  ${t.fg("warning", `${pending_count} pending`)} ${t.fg("dim", "·")} ${t.fg("accent", "a")} ${t.fg("muted", "to apply")}`;
			header.push(pending_text);
		} else {
			header.push("");
		}
		header.push(t.fg("dim", "─".repeat(iw)));

		// ── footer ───────────────────────────────────────────
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const hints: string[] = [
			`${t.fg("accent", "esc")} back`,
			`${t.fg("accent", "j/k")} nav`,
			`${t.fg("accent", "space")} toggle`,
			`${t.fg("accent", "enter")} expand`,
		];

		if (pending_count > 0) {
			hints.push(`${t.fg("accent", "a")} apply`);
		}

		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		// ── compute available height ─────────────────────────
		const footer_count = footer.length;
		const header_count = header.length;
		const border_count = 2;
		this.tree_view_height = Math.max(1, max_h - header_count - footer_count - border_count);

		// Ensure cursor is visible
		this.ensure_cursor_visible();

		// ── render tree rows ─────────────────────────────────
		const visible_entries = this.tree_flat.slice(
			this.tree_scroll_offset,
			this.tree_scroll_offset + this.tree_view_height,
		);

		const tree_lines: string[] = [];
		for (let vi = 0; vi < visible_entries.length; vi++) {
			const entry = visible_entries[vi];
			const absolute_idx = this.tree_scroll_offset + vi;
			const is_selected = absolute_idx === this.tree_cursor;
			tree_lines.push(this.render_tree_line(entry, iw, is_selected));
		}

		// Fill remaining space
		const fill = this.tree_view_height - tree_lines.length;
		for (let i = 0; i < fill; i++) {
			tree_lines.push("");
		}

		// Update footer with position indicator
		if (this.tree_flat.length > this.tree_view_height) {
			const pos = t.fg("dim", `${this.tree_cursor + 1}/${this.tree_flat.length}`);
			hints.push(pos);
			footer[footer.length - 1] = `  ${hints.join(t.fg("dim", "  ·  "))}`;
		}

		return this.frame_content([...header, ...tree_lines, ...footer], w, iw);
	}

	/** Get the effective index indicator for a file considering pending state */
	private file_indicator(file_path: string): { char: string; color: string } {
		const is_pending_add = this.toggle.pending_adds.has(file_path);
		const is_pending_remove = this.toggle.pending_removes.has(file_path);

		if (is_pending_add) return { char: "◉", color: "accent" }; // not indexed → pending add
		if (is_pending_remove) return { char: "◎", color: "warning" }; // indexed → pending remove
		if (this.toggle.indexed_set.has(file_path)) return { char: "●", color: "accent" }; // indexed, no change
		return { char: "○", color: "dim" }; // not indexed, no change
	}

	/** Get the effective aggregate indicator for a directory considering pending state */
	private dir_indicator(node: FileTreeNode): { char: string; color: string } {
		const descendant_paths = collect_file_paths(node);
		if (descendant_paths.length === 0) return { char: "○", color: "dim" };

		let indexed_count = 0;
		let has_pending = false;
		for (const p of descendant_paths) {
			if (this.toggle.is_effectively_indexed(p)) indexed_count++;
			if (this.toggle.pending_adds.has(p) || this.toggle.pending_removes.has(p)) has_pending = true;
		}

		const color = has_pending ? "warning" : "accent";
		if (indexed_count === descendant_paths.length) return { char: "●", color };
		if (indexed_count > 0) return { char: "◐", color };
		return { char: "○", color: has_pending ? "warning" : "dim" };
	}

	private render_tree_line(entry: FlatTreeEntry, iw: number, is_selected: boolean): string {
		const t = this.theme;
		const { node, depth, is_last, parent_is_last } = entry;

		// Build tree guide prefix
		let prefix = " ";
		for (let d = 0; d < depth; d++) {
			if (d < parent_is_last.length && parent_is_last[d]) {
				prefix += "   ";
			} else {
				prefix += `${t.fg("dim", "│")}  `;
			}
		}

		// Connector
		const connector = depth > 0 ? (is_last ? t.fg("dim", "└─ ") : t.fg("dim", "├─ ")) : "";

		// Node content
		let label: string;
		if (node.is_dir) {
			const is_collapsed = this.tree_collapsed.has(node.path);
			const chevron = is_collapsed ? "▸" : "▾";
			const dir_name = is_selected ? t.fg("accent", t.bold(`${node.name}/`)) : t.fg("muted", `${node.name}/`);
			const count = t.fg("dim", `(${node.file_count})`);
			const ind = this.dir_indicator(node);
			label = `${t.fg(ind.color, ind.char)} ${t.fg("accent", chevron)} ${dir_name} ${count}`;
		} else {
			const ind = this.file_indicator(node.path);
			const file_name = is_selected ? t.fg("accent", node.name) : node.name;
			label = `${t.fg(ind.color, ind.char)} ${file_name}`;
		}

		const line = `${prefix}${connector}${label}`;

		// Selection marker
		const marker = is_selected ? t.fg("accent", "▸") : " ";

		return truncateToWidth(`${marker}${line}`, iw);
	}

	// ── Updating view rendering ─────────────────────────────

	private render_updating_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const snap = this.snapshot;

		const is_applying = this.view === "applying";
		const badge_label = is_applying ? "applying…" : "updating…";

		const content: string[] = [];
		content.push("");

		const icon = t.fg("accent", QMD_PANEL_ICON);
		const title = ` ${icon} ${t.fg("accent", t.bold("QMD Index"))}`;
		const badge = `${t.fg("warning", badge_label)} `;
		const gap = Math.max(1, iw - visibleWidth(title) - visibleWidth(badge) - 1);
		content.push(`${title}${" ".repeat(gap)}${badge}`);
		content.push("");

		const summary_parts = [snap.collection_key, snap.glob_pattern, `${snap.total_documents} docs`].filter(Boolean);
		content.push(`  ${t.fg("dim", summary_parts.join("  ·  "))}`);

		if (this.update_progress) {
			content.push(`  ${t.fg("muted", this.update_progress)}`);
		} else {
			content.push(`  ${t.fg("muted", "indexing…")}`);
		}

		content.push("");

		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));
		footer.push(`  ${t.fg("accent", "esc")} cancel`);

		return this.frame_content([...content, ...footer], w, iw);
	}

	// ── Actions ─────────────────────────────────────────────

	private async refresh(): Promise<void> {
		try {
			this.snapshot = await this.callbacks.get_snapshot();
			this.scroll_offset = 0;
			if (this.view === "files") {
				// Rebuild tree from new snapshot
				this.toggle = new ToggleState(this.snapshot.indexed_paths);
				this.tree_roots = build_file_tree(this.snapshot.filesystem_paths, this.toggle.indexed_set);
				this.rebuild_tree_flat();
			}
			this.tui.requestRender();
		} catch {
			this.tui.requestRender();
		}
	}

	private async start_update(): Promise<void> {
		if (this.updating) return;
		this.updating = true;
		this.view = "updating";
		this.update_progress = null;
		this.tui.requestRender();

		try {
			await this.callbacks.on_update();
			this.snapshot = await this.callbacks.get_snapshot();
			this.view = "overview";
			this.scroll_offset = 0;
		} catch {
			this.view = "overview";
		} finally {
			this.updating = false;
			this.update_progress = null;
			this.tui.requestRender();
		}
	}

	// ── Layout helpers ──────────────────────────────────────

	private status_badge(snap: QmdPanelSnapshot): string {
		const t = this.theme;
		if (snap.binding_status === "unavailable") {
			return t.fg("error", "unavailable");
		}
		if (snap.binding_status === "not_indexed") {
			return t.fg("warning", "not indexed");
		}
		if (snap.freshness_status === "stale") {
			return `${t.fg("muted", "indexed")} ${t.fg("dim", "·")} ${t.fg("warning", `${snap.stale_count} stale`)}`;
		}
		if (snap.freshness_status === "fresh") {
			return t.fg("accent", "indexed ✓");
		}
		return `${t.fg("muted", "indexed")} ${t.fg("dim", "·")} ${t.fg("dim", "freshness ?")}`;
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

	private overview_footer(snap: QmdPanelSnapshot, iw: number): string[] {
		const t = this.theme;
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const hints: string[] = [`${t.fg("accent", "esc")} close`];

		if (snap.binding_status === "indexed") {
			hints.push(`${t.fg("accent", "u")} update`);
			hints.push(`${t.fg("accent", "r")} refresh`);
			if (snap.filesystem_paths.length > 0) {
				hints.push(`${t.fg("accent", "enter")} files`);
			}
			if (this.content_lines.length > this.scroll_view_height) {
				hints.push(`${t.fg("accent", "j/k")} scroll`);
			}
		} else if (snap.binding_status === "not_indexed") {
			hints.push(`${t.fg("accent", "i")} init`);
			hints.push(`${t.fg("accent", "r")} refresh`);
		} else {
			hints.push(`${t.fg("accent", "r")} refresh`);
		}

		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);
		return footer;
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

// ── Standalone helpers ──────────────────────────────────────

function pad_to_width(value: string, width: number): string {
	const vis = visibleWidth(value);
	if (vis >= width) return truncateToWidth(value, width);
	return value + " ".repeat(width - vis);
}
