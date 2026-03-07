import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	SESSION_STATS_PANEL_COMMAND,
	SESSION_STATS_PANEL_COMMAND_ALIAS,
	SESSION_STATS_PANEL_SHORTCUT,
	SESSION_STATS_STATUS_ICON,
	SESSION_STATS_STATUS_KEY,
} from "./constants.js";
import { build_plain_text_summary, show_session_stats_panel } from "./panel.js";
import { reconstruct_stats } from "./tracker.js";
import type { SessionStats } from "./types.js";

export default function session_stats_extension(pi: ExtensionAPI) {
	let panel_open = false;
	let close_panel: (() => void) | null = null;

	const build_stats = (ctx: ExtensionContext): SessionStats => {
		const branch = ctx.sessionManager.getBranch();
		const model = ctx.model;
		const current_model = model ? { id: model.id, name: model.name, provider: model.provider } : undefined;
		const stats = reconstruct_stats(branch as Array<{ type: string; timestamp: string }>, current_model);

		// Inject tool availability (not in session entries)
		const all_tools = pi.getAllTools();
		stats.available_tool_count = all_tools.length;
		stats.available_tool_names = all_tools.map((t) => t.name);

		return stats;
	};

	const set_footer_status = (ctx: ExtensionContext) => {
		ctx.ui.setStatus(SESSION_STATS_STATUS_KEY, ctx.ui.theme.fg("accent", SESSION_STATS_STATUS_ICON));
	};

	const open_or_toggle_panel = async (ctx: ExtensionContext) => {
		if (panel_open && close_panel) {
			close_panel();
			return;
		}

		if (!ctx.hasUI) {
			console.log(build_plain_text_summary(build_stats(ctx)));
			return;
		}

		panel_open = true;
		try {
			await show_session_stats_panel(ctx, {
				get_stats: () => build_stats(ctx),
				shortcut_key: SESSION_STATS_PANEL_SHORTCUT,
				on_panel_open: (close) => {
					close_panel = close;
				},
			});
		} catch {
			ctx.ui.notify("Session Stats panel failed to render.", "warning");
			ctx.ui.notify(build_plain_text_summary(build_stats(ctx)), "info");
		} finally {
			panel_open = false;
			close_panel = null;
		}
	};

	// ── commands and shortcuts ───────────────────────────────

	pi.registerCommand(SESSION_STATS_PANEL_COMMAND, {
		description: "Open the Session Stats panel",
		handler: async (_args, ctx) => {
			await open_or_toggle_panel(ctx);
		},
	});

	pi.registerCommand(SESSION_STATS_PANEL_COMMAND_ALIAS, {
		description: "Alias for /session-stats",
		handler: async (_args, ctx) => {
			await open_or_toggle_panel(ctx);
		},
	});

	pi.registerShortcut(SESSION_STATS_PANEL_SHORTCUT, {
		description: "Toggle the Session Stats panel",
		handler: async (ctx) => {
			await open_or_toggle_panel(ctx);
		},
	});

	// ── session lifecycle (footer only) ──────────────────────

	pi.on("session_start", (_event, ctx) => {
		if (close_panel) {
			close_panel();
			close_panel = null;
		}
		panel_open = false;
		set_footer_status(ctx);
	});

	pi.on("session_switch", (_event, ctx) => {
		if (close_panel) {
			close_panel();
			close_panel = null;
		}
		panel_open = false;
		set_footer_status(ctx);
	});
}
