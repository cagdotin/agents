import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DAMAGE_CONTROL_LOG_ENTRY_TYPE } from "./constants.js";
import { truncate_preview } from "./matcher.js";
import type { DamageControlPanelRow, RuleSourceKind, ViolationType } from "./types.js";

const LOG_ACTIONS = new Set(["blocked", "blocked_by_user", "confirmed_by_user", "allowed"] as const);
const VIOLATION_TYPES = new Set(["bash_pattern", "zero_access", "read_only", "no_delete"] as const);
const RULE_SOURCES = new Set(["bundled", "global", "project"] as const);

export function get_recent_damage_control_rows(ctx: ExtensionContext, limit: number): DamageControlPanelRow[] {
	const rows: DamageControlPanelRow[] = [];
	const safe_limit = Math.max(1, limit);
	const branch_entries = ctx.sessionManager.getBranch();

	for (let index = branch_entries.length - 1; index >= 0; index -= 1) {
		if (rows.length >= safe_limit) break;
		const entry = branch_entries[index] as Record<string, unknown> | undefined;
		if (!entry) continue;
		if (entry.type !== "custom") continue;
		if (entry.customType !== DAMAGE_CONTROL_LOG_ENTRY_TYPE) continue;

		const panel_row = to_panel_row(entry.data);
		if (!panel_row) continue;
		rows.push(panel_row);
	}

	return rows;
}

function to_panel_row(raw_entry: unknown): DamageControlPanelRow | undefined {
	if (!is_record(raw_entry)) return undefined;

	const timestamp = normalize_timestamp(raw_entry.timestamp);
	const action = as_action(raw_entry.action);
	const tool_name = as_non_empty_string(raw_entry.tool_name);
	const reason = as_non_empty_string(raw_entry.reason);
	const rule_type = as_violation_type(raw_entry.rule_type);
	const rule_source = as_rule_source(raw_entry.rule_source);

	if (!timestamp || !action || !tool_name || !reason || !rule_type || !rule_source) {
		return undefined;
	}

	const input_preview = typeof raw_entry.input_preview === "string" ? raw_entry.input_preview : "";

	return {
		timestamp,
		action,
		tool_name: truncate_preview(tool_name, 80),
		reason: truncate_preview(reason, 500),
		rule_type,
		rule_source,
		input_preview: truncate_preview(input_preview, 500),
	};
}

function normalize_timestamp(value: unknown): string | undefined {
	if (typeof value !== "string" || value.trim().length === 0) return undefined;
	const timestamp = new Date(value);
	if (Number.isNaN(timestamp.getTime())) return undefined;
	return timestamp.toISOString();
}

function as_action(value: unknown): DamageControlPanelRow["action"] | undefined {
	if (typeof value !== "string") return undefined;
	if (!LOG_ACTIONS.has(value as DamageControlPanelRow["action"])) return undefined;
	return value as DamageControlPanelRow["action"];
}

function as_violation_type(value: unknown): ViolationType | undefined {
	if (typeof value !== "string") return undefined;
	if (!VIOLATION_TYPES.has(value as ViolationType)) return undefined;
	return value as ViolationType;
}

function as_rule_source(value: unknown): RuleSourceKind | undefined {
	if (typeof value !== "string") return undefined;
	if (!RULE_SOURCES.has(value as RuleSourceKind)) return undefined;
	return value as RuleSourceKind;
}

function as_non_empty_string(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed;
}

function is_record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
