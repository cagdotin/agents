import {
	type ExtensionAPI,
	type ExtensionContext,
	isToolCallEventType,
	type ToolCallEvent,
} from "@mariozechner/pi-coding-agent";
import {
	DAMAGE_CONTROL_BLOCK_INSTRUCTION,
	DAMAGE_CONTROL_CONFIRM_TIMEOUT_MS,
	DAMAGE_CONTROL_DISABLE_BANNER_KEY,
	DAMAGE_CONTROL_LOG_ENTRY_TYPE,
	DAMAGE_CONTROL_PANEL_COMMAND,
	DAMAGE_CONTROL_PANEL_COMMAND_ALIAS,
	DAMAGE_CONTROL_PANEL_SHORTCUT,
	DAMAGE_CONTROL_STATUS_ICON,
	DAMAGE_CONTROL_STATUS_KEY,
} from "./constants.js";
import { get_recent_damage_control_rows } from "./logs.js";
import { truncate_preview } from "./matcher.js";
import { show_damage_control_panel } from "./panel.js";
import { evaluate_tool_call } from "./policy.js";
import { load_rules } from "./rules-loader.js";
import type {
	ActiveRules,
	DamageControlFooterState,
	DamageControlLogEntry,
	DamageControlUiState,
	PolicyViolation,
	RuleSourceKind,
} from "./types.js";

function empty_rules(): ActiveRules {
	return {
		bash_tool_patterns: [],
		zero_access_paths: [],
		read_only_paths: [],
		no_delete_paths: [],
		warnings: [],
	};
}

function create_ui_state(): DamageControlUiState {
	return {
		unread_count: 0,
		panel_open: false,
		last_opened_at: null,
		incident_active: false,
		enabled: true,
	};
}

export default function damage_control_extension(pi: ExtensionAPI) {
	let active_rules: ActiveRules = empty_rules();
	let loaded_rule_sources: RuleSourceKind[] = [];
	let ui_state: DamageControlUiState = create_ui_state();
	let close_panel: (() => void) | null = null;

	const refresh_footer_status = (ctx: ExtensionContext) => {
		ctx.ui.setStatus(DAMAGE_CONTROL_STATUS_KEY, format_status_icon(ctx, ui_state));

		if (!ui_state.enabled) {
			ctx.ui.setStatus(DAMAGE_CONTROL_DISABLE_BANNER_KEY, ctx.ui.theme.fg("warning", "⚠ DC OFF"));
		} else {
			ctx.ui.setStatus(DAMAGE_CONTROL_DISABLE_BANNER_KEY, undefined);
		}
	};

	const mark_panel_viewed = (ctx: ExtensionContext) => {
		ui_state.unread_count = 0;
		ui_state.incident_active = false;
		ui_state.last_opened_at = new Date().toISOString();
		refresh_footer_status(ctx);
	};

	const track_policy_event = (action: DamageControlLogEntry["action"], ctx: ExtensionContext) => {
		if (action === "blocked" || action === "blocked_by_user" || action === "confirmed_by_user") {
			ui_state.unread_count += 1;
		}

		if (action === "blocked" || action === "blocked_by_user") {
			ui_state.incident_active = true;
		}

		refresh_footer_status(ctx);
	};

	const open_or_toggle_panel = async (ctx: ExtensionContext) => {
		if (ui_state.panel_open && close_panel) {
			close_panel();
			return;
		}

		if (!ctx.hasUI) {
			console.log(build_panel_summary_for_terminal(ctx, active_rules, loaded_rule_sources, ui_state.enabled));
			return;
		}

		mark_panel_viewed(ctx);
		ui_state.panel_open = true;

		try {
			await show_damage_control_panel(ctx, {
				active_rules,
				loaded_sources: loaded_rule_sources,
				get_rows: (limit) => get_recent_damage_control_rows(ctx, limit),
				get_footer_state: () => get_footer_state(ui_state),
				is_enabled: () => ui_state.enabled,
				on_toggle_enabled: () => {
					ui_state.enabled = !ui_state.enabled;
					refresh_footer_status(ctx);
					const label = ui_state.enabled ? "enabled" : "disabled";
					ctx.ui.notify(`🛡 Damage-Control ${label}`, ui_state.enabled ? "info" : "warning");
				},
				shortcut_key: DAMAGE_CONTROL_PANEL_SHORTCUT,
				on_panel_open: (close) => {
					close_panel = close;
				},
			});
		} catch {
			ctx.ui.notify("Damage-Control panel failed to render.", "warning");
			ctx.ui.notify(build_panel_summary_for_terminal(ctx, active_rules, loaded_rule_sources), "info");
		} finally {
			ui_state.panel_open = false;
			close_panel = null;
			refresh_footer_status(ctx);
		}
	};

	const load_active_rules = async (ctx: ExtensionContext) => {
		if (close_panel) {
			close_panel();
			close_panel = null;
		}

		const result = await load_rules(ctx.cwd, import.meta.url);
		active_rules = result.rules;
		loaded_rule_sources = unique_rule_source_kinds(result.stats.loaded_sources.map((source) => source.kind));
		ui_state = create_ui_state();
		refresh_footer_status(ctx);

		const summary = format_rule_summary(active_rules);
		const loaded_labels = loaded_rule_sources.join(", ");
		if (loaded_labels.length > 0) {
			ctx.ui.notify(`🛡 Damage-Control active (${loaded_labels}) — ${summary}`, "info");
		} else {
			ctx.ui.notify("🛡 Damage-Control active with zero rules (all sources missing/invalid)", "warning");
		}

		if (result.stats.invalid_rule_count > 0) {
			ctx.ui.notify(
				`Damage-Control ignored ${result.stats.invalid_rule_count} invalid rule entr${result.stats.invalid_rule_count === 1 ? "y" : "ies"}.`,
				"warning",
			);
		}
	};

	const handle_confirmation = async (
		event: ToolCallEvent,
		ctx: ExtensionContext,
		violation: PolicyViolation,
	): Promise<{ block: boolean; reason?: string }> => {
		if (!ctx.hasUI) {
			const reason =
				`🛑 BLOCKED by Damage-Control: ${violation.reason}. ` +
				"Rule action is 'ask', but interactive UI is unavailable for confirmation.\n\n" +
				DAMAGE_CONTROL_BLOCK_INSTRUCTION;
			append_log_entry(pi, event, violation, "blocked");
			track_policy_event("blocked", ctx);
			return { block: true, reason };
		}

		const input_preview = describe_tool_input(event);
		const confirmed = await ctx.ui.confirm(
			"🛡️ Damage-Control confirmation",
			`Rule matched: ${violation.reason}\n\nTool: ${event.toolName}\nInput: ${input_preview}\n\nAllow this tool call?`,
			{ timeout: DAMAGE_CONTROL_CONFIRM_TIMEOUT_MS },
		);

		if (!confirmed) {
			append_log_entry(pi, event, violation, "blocked_by_user");
			track_policy_event("blocked_by_user", ctx);
			const reason = `🛑 BLOCKED by Damage-Control: ${violation.reason} (denied by user).\n\n${DAMAGE_CONTROL_BLOCK_INSTRUCTION}`;
			return { block: true, reason };
		}

		append_log_entry(pi, event, violation, "confirmed_by_user");
		track_policy_event("confirmed_by_user", ctx);
		ctx.ui.notify(`🛡 Damage-Control approved ${event.toolName} after confirmation.`, "info");
		return { block: false };
	};

	pi.registerCommand(DAMAGE_CONTROL_PANEL_COMMAND, {
		description: "Open the Damage-Control policy panel",
		handler: async (_args, ctx) => {
			await open_or_toggle_panel(ctx);
		},
	});

	pi.registerCommand(DAMAGE_CONTROL_PANEL_COMMAND_ALIAS, {
		description: "Alias for /damage-control",
		handler: async (_args, ctx) => {
			await open_or_toggle_panel(ctx);
		},
	});

	pi.registerShortcut(DAMAGE_CONTROL_PANEL_SHORTCUT, {
		description: "Toggle the Damage-Control panel",
		handler: async (ctx) => {
			await open_or_toggle_panel(ctx);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		await load_active_rules(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		await load_active_rules(ctx);
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!ui_state.enabled) {
			return { block: false };
		}

		const result = evaluate_tool_call(event, ctx.cwd, active_rules);
		if (!result.violation) {
			return { block: false };
		}

		if (result.confirmation_required) {
			return handle_confirmation(event, ctx, result.violation);
		}

		const block_reason = format_block_reason(result.violation);
		ctx.ui.notify(`🛑 Damage-Control blocked ${event.toolName}: ${result.violation.reason}`, "warning");
		append_log_entry(pi, event, result.violation, "blocked");
		track_policy_event("blocked", ctx);
		return {
			block: true,
			reason: block_reason,
		};
	});
}

function append_log_entry(
	pi: ExtensionAPI,
	event: ToolCallEvent,
	violation: PolicyViolation,
	action: DamageControlLogEntry["action"],
): void {
	const entry: DamageControlLogEntry = {
		timestamp: new Date().toISOString(),
		tool_name: event.toolName,
		action,
		reason: violation.reason,
		rule_type: violation.type,
		rule_pattern: violation.rule_pattern,
		rule_id: violation.rule_id,
		rule_source: violation.source.kind,
		input_preview: describe_tool_input(event),
	};
	pi.appendEntry(DAMAGE_CONTROL_LOG_ENTRY_TYPE, entry);
}

function format_rule_summary(rules: ActiveRules): string {
	return [
		`${rules.bash_tool_patterns.length} bash`,
		`${rules.zero_access_paths.length} zero`,
		`${rules.read_only_paths.length} read-only`,
		`${rules.no_delete_paths.length} no-delete`,
	].join(" · ");
}

function format_block_reason(violation: PolicyViolation): string {
	return `🛑 BLOCKED by Damage-Control: ${violation.reason}\n\n${DAMAGE_CONTROL_BLOCK_INSTRUCTION}`;
}

function format_status_icon(ctx: ExtensionContext, ui_state: DamageControlUiState): string {
	if (!ui_state.enabled) {
		return ctx.ui.theme.fg("dim", DAMAGE_CONTROL_STATUS_ICON);
	}
	const state = get_footer_state(ui_state);
	if (state === "incident") {
		return ctx.ui.theme.fg("error", DAMAGE_CONTROL_STATUS_ICON);
	}
	if (state === "notify") {
		return ctx.ui.theme.fg("warning", DAMAGE_CONTROL_STATUS_ICON);
	}
	return ctx.ui.theme.fg("success", DAMAGE_CONTROL_STATUS_ICON);
}

function get_footer_state(ui_state: DamageControlUiState): DamageControlFooterState {
	if (ui_state.incident_active) {
		return "incident";
	}
	if (ui_state.unread_count > 0) {
		return "notify";
	}
	return "healthy";
}

function unique_rule_source_kinds(values: RuleSourceKind[]): RuleSourceKind[] {
	const seen = new Set<RuleSourceKind>();
	const result: RuleSourceKind[] = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	return result;
}

function describe_tool_input(event: ToolCallEvent): string {
	if (isToolCallEventType("bash", event)) {
		return truncate_preview(event.input.command, 500);
	}

	if (isToolCallEventType("read", event) || isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
		return truncate_preview(event.input.path, 500);
	}

	return truncate_preview(safe_json(event.input), 500);
}

function safe_json(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return "[unserializable input]";
	}
}

function build_panel_summary_for_terminal(
	ctx: ExtensionContext,
	active_rules: ActiveRules,
	loaded_rule_sources: RuleSourceKind[],
	enabled: boolean,
): string {
	const rows = get_recent_damage_control_rows(ctx, 5);
	const lines: string[] = [];
	lines.push(`Damage Control${enabled ? "" : " (DISABLED)"}`);
	lines.push(
		`Rules: bash ${active_rules.bash_tool_patterns.length}, zero ${active_rules.zero_access_paths.length}, read-only ${active_rules.read_only_paths.length}, no-delete ${active_rules.no_delete_paths.length}`,
	);
	lines.push(`Sources: ${loaded_rule_sources.length > 0 ? loaded_rule_sources.join(", ") : "none"}`);

	if (rows.length === 0) {
		lines.push("Recent activity: none");
		return lines.join("\n");
	}

	lines.push("Recent activity:");
	for (const row of rows) {
		lines.push(`- ${row.timestamp} ${row.action} ${row.tool_name} [${row.rule_type}/${row.rule_source}] ${row.reason}`);
	}
	return lines.join("\n");
}
