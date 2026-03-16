import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { QMD_PANEL_ICON, QMD_PANEL_SHORTCUT, QMD_PANEL_WIDTH } from "./constants.js";
import type { FileTreeNode, FlatTreeEntry, QmdCollectionSummary, QmdPanelSnapshot } from "./data.js";
import { build_file_tree, collect_file_paths, flatten_tree, format_relative_time } from "./data.js";
import { ToggleState } from "./toggle-state.js";

type PanelView = "overview" | "collections" | "files" | "updating" | "applying";

export interface QmdPanelCallbacks {
	get_snapshot: (selected_collection_key?: string) => Promise<QmdPanelSnapshot>;
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

	// Collections view state
	private selected_collection_key: string | null;
	private collection_cursor = 0;
	private collection_scroll_offset = 0;
	private collection_view_height = 0;
	private collection_filter_query = "";
	private collection_filter_editing = false;

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
		this.selected_collection_key = initial_snapshot.collection_key;
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
		} else if (this.view === "collections") {
			this.handle_collections_input(key_data);
		} else if (this.view === "updating" || this.view === "applying") {
			this.handle_updating_input(key_data);
		} else {
			this.handle_overview_input(key_data);
		}
	}

	render(width: number): string[] {
		if (this.view === "files") {
			return this.render_files_view(width);
		}
		if (this.view === "collections") {
			return this.render_collections_view(width);
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
		if (matchesKey(key_data, "c") && this.snapshot.collections.length > 0) {
			this.open_collections_view();
			return;
		}
		if (matchesKey(key_data, "u") && this.snapshot.supports_update_action) {
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
			this.snapshot.collection_key &&
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
		if (matchesKey(key_data, "c") && this.snapshot.collections.length > 0) {
			this.open_collections_view();
			return;
		}
		// enter / l / right → expand/collapse dirs
		if (matchesKey(key_data, "enter") || matchesKey(key_data, "l") || matchesKey(key_data, "right")) {
			this.tree_toggle_expand();
			return;
		}
		// space → toggle file/dir index inclusion (bound collection only)
		if (matchesKey(key_data, "space") && this.snapshot.supports_file_toggling) {
			this.tree_toggle_inclusion();
			return;
		}
		// a → apply pending changes (bound collection only)
		if (matchesKey(key_data, "a") && this.snapshot.supports_file_toggling) {
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

	// ── Collections input ───────────────────────────────────

	private handle_collections_input(key_data: string): void {
		if (
			matchesKey(key_data, "escape") ||
			matchesKey(key_data, "q") ||
			matchesKey(key_data, "h") ||
			matchesKey(key_data, "left")
		) {
			if (this.collection_filter_editing) {
				this.collection_filter_editing = false;
				this.tui.requestRender();
				return;
			}
			if (this.collection_filter_query.length > 0) {
				this.collection_filter_query = "";
				this.sync_collection_cursor(this.snapshot.collection_key);
				this.tui.requestRender();
				return;
			}
			this.view = "overview";
			this.tui.requestRender();
			return;
		}

		if (this.collection_filter_editing) {
			if (matchesKey(key_data, "enter")) {
				this.collection_filter_editing = false;
				this.tui.requestRender();
				return;
			}
			if (matchesKey(key_data, "backspace")) {
				if (this.collection_filter_query.length > 0) {
					this.collection_filter_query = this.collection_filter_query.slice(0, -1);
					this.sync_collection_cursor(this.snapshot.collection_key);
				}
				this.tui.requestRender();
				return;
			}
			if (matchesKey(key_data, "ctrl+u")) {
				this.collection_filter_query = "";
				this.sync_collection_cursor(this.snapshot.collection_key);
				this.tui.requestRender();
				return;
			}
			const printable_char = get_printable_char(key_data);
			if (printable_char) {
				this.collection_filter_query += printable_char;
				this.sync_collection_cursor(this.snapshot.collection_key);
				this.tui.requestRender();
			}
			return;
		}

		if (get_printable_char(key_data) === "/") {
			this.collection_filter_editing = true;
			this.tui.requestRender();
			return;
		}

		if (matchesKey(key_data, "r")) {
			this.refresh();
			return;
		}

		if (matchesKey(key_data, "enter") || matchesKey(key_data, "l") || matchesKey(key_data, "right")) {
			this.select_current_collection();
			return;
		}

		if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
			this.collection_move_cursor(1);
			return;
		}
		if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
			this.collection_move_cursor(-1);
			return;
		}
		if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
			this.collection_set_cursor(0);
			return;
		}
		if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
			const total = this.get_filtered_collection_indices().length;
			this.collection_set_cursor(total - 1);
			return;
		}
		if (matchesKey(key_data, "pageDown")) {
			this.collection_move_cursor(this.collection_view_height || 1);
			return;
		}
		if (matchesKey(key_data, "pageUp")) {
			this.collection_move_cursor(-(this.collection_view_height || 1));
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

	// ── Collection selector helpers ─────────────────────────

	private open_collections_view(): void {
		if (this.snapshot.collections.length === 0) return;
		this.toggle.clear();
		this.collection_filter_query = "";
		this.collection_filter_editing = false;
		this.sync_collection_cursor(this.snapshot.collection_key);
		this.collection_scroll_offset = 0;
		this.view = "collections";
		this.tui.requestRender();
	}

	private collection_move_cursor(delta: number): void {
		const filtered_count = this.get_filtered_collection_indices().length;
		if (filtered_count === 0) return;
		const next = Math.max(0, Math.min(this.collection_cursor + delta, filtered_count - 1));
		if (next === this.collection_cursor) return;
		this.collection_cursor = next;
		this.tui.requestRender();
	}

	private collection_set_cursor(idx: number): void {
		const filtered_count = this.get_filtered_collection_indices().length;
		if (filtered_count === 0) return;
		const clamped = Math.max(0, Math.min(idx, filtered_count - 1));
		if (clamped === this.collection_cursor) return;
		this.collection_cursor = clamped;
		this.tui.requestRender();
	}

	private ensure_collection_cursor_visible(): void {
		const filtered_count = this.get_filtered_collection_indices().length;
		if (filtered_count === 0) {
			this.collection_scroll_offset = 0;
			return;
		}
		if (this.collection_cursor < this.collection_scroll_offset) {
			this.collection_scroll_offset = this.collection_cursor;
		} else if (this.collection_cursor >= this.collection_scroll_offset + this.collection_view_height) {
			this.collection_scroll_offset = this.collection_cursor - this.collection_view_height + 1;
		}
		const max_scroll = Math.max(0, filtered_count - this.collection_view_height);
		this.collection_scroll_offset = Math.max(0, Math.min(this.collection_scroll_offset, max_scroll));
	}

	private get_filtered_collection_indices(): number[] {
		const query = this.collection_filter_query.trim().toLowerCase();
		if (!query) {
			return this.snapshot.collections.map((_c, idx) => idx);
		}
		return this.snapshot.collections
			.map((collection, idx) => ({ collection, idx }))
			.filter(({ collection }) => {
				return [collection.key, collection.repo_root ?? "", collection.glob_pattern ?? ""]
					.join(" ")
					.toLowerCase()
					.includes(query);
			})
			.map(({ idx }) => idx);
	}

	private sync_collection_cursor(preferred_key: string | null): void {
		const filtered = this.get_filtered_collection_indices();
		if (filtered.length === 0) {
			this.collection_cursor = 0;
			this.collection_scroll_offset = 0;
			return;
		}

		if (preferred_key) {
			const preferred_cursor = filtered.findIndex((idx) => this.snapshot.collections[idx]?.key === preferred_key);
			if (preferred_cursor >= 0) {
				this.collection_cursor = preferred_cursor;
			} else {
				this.collection_cursor = Math.min(this.collection_cursor, filtered.length - 1);
			}
		} else {
			this.collection_cursor = Math.min(this.collection_cursor, filtered.length - 1);
		}

		if (this.collection_cursor < 0) this.collection_cursor = 0;
	}

	private select_current_collection(): void {
		const filtered = this.get_filtered_collection_indices();
		if (filtered.length === 0) return;
		const selected_idx = filtered[this.collection_cursor];
		const selected = this.snapshot.collections[selected_idx];
		if (!selected) return;
		this.selected_collection_key = selected.key;
		this.refresh_selected_collection();
	}

	private async refresh_selected_collection(): Promise<void> {
		try {
			this.snapshot = await this.callbacks.get_snapshot(this.selected_collection_key ?? undefined);
			this.selected_collection_key = this.snapshot.collection_key;
			this.view = "overview";
			this.scroll_offset = 0;
			this.tui.requestRender();
		} catch {
			this.tui.requestRender();
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
		if (this.updating || !this.snapshot.supports_file_toggling) return;
		const adds = [...this.toggle.pending_adds];
		const removes = [...this.toggle.pending_removes];
		if (adds.length === 0 && removes.length === 0) return;

		this.updating = true;
		this.view = "applying";
		this.update_progress = `${removes.length} to remove, ${adds.length} to add…`;
		this.tui.requestRender();

		try {
			await this.callbacks.on_toggle_files(adds, removes);
			this.snapshot = await this.callbacks.get_snapshot(this.selected_collection_key ?? undefined);
			this.selected_collection_key = this.snapshot.collection_key;
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
		} else if (!snap.collection_key) {
			if (snap.repo_root) {
				content.push(`  ${snap.repo_root}`);
			}
			content.push("");
			if (snap.collections.length > 0) {
				content.push(`  ${t.fg("muted", `Found ${snap.collections.length} collections. Press c to browse.`)}`);
			} else {
				content.push(`  ${t.fg("muted", "Run /qmd init to onboard this repository.")}`);
			}
			content.push("");
		} else {
			this.render_selected_overview(content, snap, iw);
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

	private render_selected_overview(content: string[], snap: QmdPanelSnapshot, iw: number): void {
		const t = this.theme;

		content.push(...this.render_collection_info_card(snap, iw));
		content.push("");

		// ── Index section ────────────────────────────────────
		const embed_right =
			snap.needs_embedding > 0
				? `${t.fg("warning", `${snap.needs_embedding}`)} ${t.fg("muted", "pending embed")} `
				: `${t.fg("dim", "0 pending embed")} `;
		content.push(this.section_header("Index", embed_right, iw));
		content.push("");
		content.push(`    ${t.fg("muted", "documents")}${" ".repeat(6)}${snap.total_documents}`);
		content.push(`    ${t.fg("muted", "vector index")}${" ".repeat(3)}${snap.has_vector_index ? "✓" : "✗"}`);
		content.push(`    ${t.fg("muted", "needs embed")}${" ".repeat(4)}${snap.needs_embedding}`);
		content.push(`    ${t.fg("muted", "collections")}${" ".repeat(4)}${snap.collections.length}`);
		content.push("");

		// ── Contexts section ─────────────────────────────────
		if (snap.contexts.length > 0) {
			content.push(this.section_header(`Contexts (${snap.contexts.length})`, "", iw));
			content.push("");
			const max_path_len = Math.min(24, Math.max(8, ...snap.contexts.map((ctx) => ctx.path.length)));
			const col_w = max_path_len + 2;
			for (const ctx of snap.contexts) {
				const path_str = t.fg("accent", ctx.path.padEnd(col_w));
				const ann_max = Math.max(10, iw - col_w - 4);
				content.push(`  ${path_str}${t.fg("dim", truncateToWidth(ctx.annotation, ann_max))}`);
			}
			content.push("");
		}

		// ── Stale section ────────────────────────────────────
		if (snap.selected_collection_scope === "bound" && snap.stale_count > 0) {
			const stale_right = snap.supports_update_action ? `${t.fg("accent", "u")} ${t.fg("muted", "to update")} ` : "";
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

	// ── Collections view rendering ──────────────────────────

	private render_collections_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const max_h = this.get_max_height();
		const collections = this.snapshot.collections;
		const filtered_indices = this.get_filtered_collection_indices();
		const filtered_count = filtered_indices.length;

		const header: string[] = [];
		header.push("");
		// Same title bar as overview, with › Collections breadcrumb
		const icon = t.fg("accent", QMD_PANEL_ICON);
		const title = ` ${icon} ${t.fg("accent", t.bold("QMD Index"))} ${t.fg("dim", "›")} ${t.fg("accent", t.bold("Collections"))}`;
		const badge = this.status_badge(this.snapshot);
		const hgap = Math.max(1, iw - visibleWidth(title) - visibleWidth(badge) - 1);
		header.push(`${title}${" ".repeat(hgap)}${badge} `);
		header.push(...this.render_collection_info_card(this.snapshot, iw));
		// Filter + count row
		const filter_mode = this.collection_filter_editing ? t.fg("accent", "[typing]") : t.fg("dim", "[idle]");
		const filter_value = this.collection_filter_query
			? t.fg("accent", `/${this.collection_filter_query}`)
			: t.fg("dim", "/");
		const filter_left = `  ${t.fg("muted", "filter")} ${filter_value} ${filter_mode}`;
		const col_count = `${t.fg("accent", `${filtered_count}`)}${t.fg("dim", "/")}${t.fg("muted", `${collections.length}`)} ${t.fg("dim", "shown")}`;
		const filter_gap = Math.max(2, iw - visibleWidth(filter_left) - visibleWidth(col_count));
		header.push(`${filter_left}${" ".repeat(filter_gap)}${col_count}`);
		header.push(t.fg("dim", "─".repeat(iw)));

		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));
		const hints: string[] = [
			`${t.fg("accent", "esc")} back/clear`,
			`${t.fg("accent", "/")} find`,
			`${t.fg("accent", "j/k")} move`,
			`${t.fg("accent", "enter")} select`,
			`${t.fg("accent", "r")} refresh`,
		];
		if (this.collection_filter_editing) {
			hints.push(`${t.fg("accent", "ctrl+u")} clear`);
		}
		footer.push(`  ${hints.join(t.fg("dim", "  ·  "))}`);

		const hovered_collection = this.get_hovered_collection(filtered_indices);
		const details_block = this.render_collection_details_block(hovered_collection, iw);

		const footer_count = footer.length;
		const header_count = header.length;
		const border_count = 2;
		const available_body_height = Math.max(1, max_h - header_count - footer_count - border_count);
		const details_height = available_body_height >= 10 ? details_block.length : 0;
		this.collection_view_height = Math.max(1, available_body_height - details_height);
		this.ensure_collection_cursor_visible();

		const visible_indices = filtered_indices.slice(
			this.collection_scroll_offset,
			this.collection_scroll_offset + this.collection_view_height,
		);

		const body: string[] = [];
		if (visible_indices.length === 0) {
			body.push(`  ${t.fg("warning", "No collections match this filter.")}`);
			body.push(`  ${t.fg("dim", "/ edit  ·  ctrl+u clear  ·  esc reset")}`);
		}

		for (let i = 0; i < visible_indices.length; i++) {
			const absolute_filtered_idx = this.collection_scroll_offset + i;
			const collection_idx = visible_indices[i];
			const collection = collections[collection_idx];
			const is_selected = absolute_filtered_idx === this.collection_cursor;
			const marker = is_selected ? t.fg("accent", "▸") : " ";
			const active_tag = collection.key === this.snapshot.collection_key ? t.fg("accent", "[selected]") : "";
			const bound_tag = collection.is_bound_collection ? t.fg("dim", "[bound]") : "";
			const doc_tag = `${t.fg("muted", `${collection.doc_count}`)} ${t.fg("dim", "docs")}`;
			const tags = [active_tag, bound_tag, doc_tag].filter(Boolean).join(t.fg("dim", " · "));
			const tags_vis = visibleWidth(tags);
			const key_max = Math.max(12, iw - 3 - tags_vis - 3);
			const key_raw = this.display_key(collection.key, key_max);
			const key_text = is_selected ? t.fg("accent", t.bold(key_raw)) : key_raw;
			const key_vis = visibleWidth(key_text);
			const tag_gap = Math.max(2, iw - 3 - key_vis - tags_vis);
			body.push(` ${marker} ${key_text}${" ".repeat(tag_gap)}${tags}`);
		}

		const fill = this.collection_view_height - body.length;
		for (let i = 0; i < fill; i++) {
			body.push("");
		}

		if (filtered_count > this.collection_view_height && filtered_count > 0) {
			const pos = `${this.collection_cursor + 1}/${filtered_count}`;
			footer[footer.length - 1] = `${footer[footer.length - 1]}  ${t.fg("dim", pos)}`;
		}

		const rendered_details = details_height > 0 ? details_block : [];
		return this.frame_content([...header, ...body, ...rendered_details, ...footer], w, iw);
	}

	private get_hovered_collection(filtered_indices: number[]): QmdCollectionSummary | null {
		if (filtered_indices.length === 0) {
			return null;
		}
		const cursor = Math.max(0, Math.min(this.collection_cursor, filtered_indices.length - 1));
		const idx = filtered_indices[cursor];
		return this.snapshot.collections[idx] ?? null;
	}

	private render_collection_details_block(collection: QmdCollectionSummary | null, iw: number): string[] {
		const t = this.theme;

		if (!collection) {
			return ["", ...this.render_card([t.fg("dim", "No collection hovered.")], iw, "details")];
		}

		const mode = collection.is_bound_collection ? t.fg("accent", "bound") : t.fg("warning", "external readonly");
		const key_display = this.display_key(collection.key, 40);
		const pattern_text = collection.glob_pattern ?? "—";
		const path_text = collection.repo_root ?? "—";

		return [
			"",
			...this.render_card(
				[
					`${t.fg("accent", t.bold(key_display))} ${t.fg("dim", "·")} ${mode}`,
					`${t.fg("accent", `${collection.doc_count}`)} ${t.fg("dim", "docs · pattern")} ${t.fg("dim", pattern_text)}`,
					`${t.fg("muted", "path")} ${t.fg("dim", path_text)}`,
				],
				iw,
				"details",
			),
		];
	}

	// ── Files (tree) view rendering ─────────────────────────

	private render_files_view(width: number): string[] {
		const t = this.theme;
		const w = Math.max(30, width);
		const iw = w - 2;
		const max_h = this.get_max_height();
		const snap = this.snapshot;

		const can_toggle = snap.supports_file_toggling;
		const pending_count = can_toggle ? this.toggle.pending_count() : 0;

		// ── header ───────────────────────────────────────────
		const header: string[] = [];
		header.push("");
		// Same title bar as overview, with › Files breadcrumb
		const icon = t.fg("accent", QMD_PANEL_ICON);
		const title = ` ${icon} ${t.fg("accent", t.bold("QMD Index"))} ${t.fg("dim", "›")} ${t.fg("accent", t.bold("Files"))}`;
		const badge = this.status_badge(snap);
		const title_gap = Math.max(1, iw - visibleWidth(title) - visibleWidth(badge) - 1);
		header.push(`${title}${" ".repeat(title_gap)}${badge} `);
		header.push(...this.render_collection_info_card(snap, iw));
		// Info row: file count (left) + pending changes (right)
		const indexed_count = snap.indexed_paths.length;
		const total_count = snap.filesystem_paths.length;
		const source_label = snap.file_paths_source === "qmd" ? "qmd paths" : "indexed";
		const count_info = `${t.fg("accent", `${indexed_count}`)}${t.fg("dim", "/")}${t.fg("muted", `${total_count}`)} ${t.fg("dim", source_label)}`;
		if (pending_count > 0) {
			const pending_info = `${t.fg("warning", `${pending_count} pending`)} ${t.fg("dim", "·")} ${t.fg("accent", "a")} ${t.fg("muted", "to apply")}`;
			const pend_gap = Math.max(2, iw - 2 - visibleWidth(count_info) - visibleWidth(pending_info));
			header.push(`  ${count_info}${" ".repeat(pend_gap)}${pending_info}`);
		} else {
			header.push(`  ${count_info}`);
		}
		header.push(t.fg("dim", "─".repeat(iw)));

		// ── footer ───────────────────────────────────────────
		const footer: string[] = [];
		footer.push(t.fg("dim", "─".repeat(iw)));

		const hints: string[] = [
			`${t.fg("accent", "esc")} back`,
			`${t.fg("accent", "j/k")} nav`,
			`${t.fg("accent", "enter")} expand`,
			`${t.fg("accent", "c")} collections`,
		];

		if (can_toggle) {
			hints.push(`${t.fg("accent", "space")} toggle`);
		}

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

		const upd_key = this.display_key(snap.collection_key ?? "—", 40);
		content.push(`  ${t.fg("accent", upd_key)}`);
		const upd_meta = [snap.glob_pattern, `${snap.total_documents} docs`].filter(Boolean).join(" · ");
		content.push(`  ${t.fg("dim", upd_meta)}`);

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
			this.snapshot = await this.callbacks.get_snapshot(this.selected_collection_key ?? undefined);
			this.selected_collection_key = this.snapshot.collection_key;
			this.scroll_offset = 0;
			if (this.view === "files") {
				// Rebuild tree from new snapshot
				this.toggle = new ToggleState(this.snapshot.indexed_paths);
				this.tree_roots = build_file_tree(this.snapshot.filesystem_paths, this.toggle.indexed_set);
				this.rebuild_tree_flat();
			}
			if (this.view === "collections") {
				this.sync_collection_cursor(this.snapshot.collection_key);
			}
			this.tui.requestRender();
		} catch {
			this.tui.requestRender();
		}
	}

	private async start_update(): Promise<void> {
		if (this.updating || !this.snapshot.supports_update_action) return;
		this.updating = true;
		this.view = "updating";
		this.update_progress = null;
		this.tui.requestRender();

		try {
			await this.callbacks.on_update();
			this.snapshot = await this.callbacks.get_snapshot(this.selected_collection_key ?? undefined);
			this.selected_collection_key = this.snapshot.collection_key;
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
		if (!snap.collection_key) {
			return snap.binding_status === "not_indexed" ? t.fg("warning", "not indexed") : t.fg("dim", "no collection");
		}
		if (snap.selected_collection_scope === "external") {
			return `${t.fg("warning", "external")} ${t.fg("dim", "·")} ${t.fg("warning", "readonly")}`;
		}
		if (snap.freshness_status === "stale") {
			return `${t.fg("muted", "indexed")} ${t.fg("dim", "·")} ${t.fg("warning", `${snap.stale_count} stale`)}`;
		}
		if (snap.freshness_status === "fresh") {
			return t.fg("accent", "indexed ✓");
		}
		return `${t.fg("muted", "indexed")} ${t.fg("dim", "·")} ${t.fg("dim", "freshness ?")}`;
	}

	// ── Reusable UI components ──────────────────────────────

	/** Bordered card showing collection name, pattern, doc count, freshness, indexed time. */
	private render_collection_info_card(snap: QmdPanelSnapshot, iw: number): string[] {
		const t = this.theme;
		const card_cw = iw - 6; // card inner content width
		const card_lines: string[] = [];

		// Row 1: collection name
		const key_display = this.display_key(snap.collection_key ?? "—", card_cw);
		card_lines.push(t.fg("accent", t.bold(key_display)));

		// Row 2: pattern · doc count · freshness
		const meta_parts: string[] = [];
		if (snap.glob_pattern) meta_parts.push(t.fg("dim", snap.glob_pattern));
		meta_parts.push(`${t.fg("accent", `${snap.total_documents}`)} ${t.fg("dim", "docs")}`);
		if (snap.selected_collection_scope === "bound") {
			if (snap.freshness_status === "fresh") meta_parts.push(t.fg("accent", "fresh ✓"));
			else if (snap.freshness_status === "stale") meta_parts.push(t.fg("warning", `${snap.stale_count} stale`));
		}
		card_lines.push(meta_parts.join(t.fg("dim", " · ")));

		// Row 3: indexed time (bound) or bound-repo hint (external)
		if (snap.selected_collection_scope === "bound" && snap.last_indexed_at) {
			const parts = [`${t.fg("muted", "indexed")} ${t.fg("dim", format_relative_time(snap.last_indexed_at))}`];
			if (snap.last_indexed_commit) parts.push(t.fg("dim", snap.last_indexed_commit.slice(0, 7)));
			card_lines.push(parts.join(t.fg("dim", " · ")));
		}
		if (snap.selected_collection_scope === "external" && snap.bound_collection_key) {
			card_lines.push(
				`${t.fg("muted", "bound repo")} ${t.fg("dim", snap.bound_collection_key)} ${t.fg("dim", "— c to switch")}`,
			);
		}

		return this.render_card(card_lines, iw);
	}

	/** Render a bordered card. Indent 2 from content edge. Optional label on top border. */
	private render_card(card_lines: string[], iw: number, label?: string): string[] {
		const t = this.theme;
		const box_w = iw - 2; // 2 for left indent
		const content_w = box_w - 4; // │ + space + content + space + │
		const result: string[] = [];
		const indent = "  ";

		if (label) {
			const lbl = ` ${t.fg("muted", label)} `;
			const lbl_vis = visibleWidth(lbl);
			const dashes = Math.max(0, box_w - 4 - lbl_vis);
			result.push(`${indent}${t.fg("dim", "┌─")}${lbl}${t.fg("dim", `${"─".repeat(dashes)}┐`)}`);
		} else {
			result.push(`${indent}${t.fg("dim", `┌${"─".repeat(box_w - 2)}┐`)}`);
		}

		for (const line of card_lines) {
			const padded = pad_to_width(truncateToWidth(line, content_w), content_w);
			result.push(`${indent}${t.fg("dim", "│")} ${padded} ${t.fg("dim", "│")}`);
		}

		result.push(`${indent}${t.fg("dim", `└${"─".repeat(box_w - 2)}┘`)}`);
		return result;
	}

	/** Cap a collection key to max_width, adding ellipsis if truncated */
	private display_key(key: string, max_width: number): string {
		if (key.length <= max_width) return key;
		if (max_width <= 3) return key.slice(0, max_width);
		return `${key.slice(0, max_width - 1)}…`;
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

		const hints: string[] = [`${t.fg("accent", "esc")} close`, `${t.fg("accent", "r")} refresh`];

		if (snap.collections.length > 0) {
			hints.push(`${t.fg("accent", "c")} collections`);
		}

		if (snap.supports_update_action) {
			hints.push(`${t.fg("accent", "u")} update`);
		}
		if (snap.collection_key && snap.filesystem_paths.length > 0) {
			hints.push(`${t.fg("accent", "enter")} files`);
		}
		if (snap.binding_status === "not_indexed") {
			hints.push(`${t.fg("accent", "i")} init`);
		}
		if (this.content_lines.length > this.scroll_view_height) {
			hints.push(`${t.fg("accent", "j/k")} scroll`);
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

function get_printable_char(key_data: string): string | null {
	if (key_data.length !== 1) return null;
	const char_code = key_data.charCodeAt(0);
	if (char_code < 32 || char_code > 126) return null;
	return key_data;
}
