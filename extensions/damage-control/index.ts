import {
	type ExtensionAPI,
	type ExtensionContext,
	isToolCallEventType,
	type ToolCallEvent,
} from "@mariozechner/pi-coding-agent";
import {
	DAMAGE_CONTROL_BLOCK_INSTRUCTION,
	DAMAGE_CONTROL_CONFIRM_TIMEOUT_MS,
	DAMAGE_CONTROL_LOG_ENTRY_TYPE,
	DAMAGE_CONTROL_STATUS_KEY,
} from "./constants.js";
import { truncate_preview } from "./matcher.js";
import { evaluate_tool_call } from "./policy.js";
import { load_rules } from "./rules-loader.js";
import type { ActiveRules, DamageControlLogEntry, PolicyViolation } from "./types.js";

function empty_rules(): ActiveRules {
	return {
		bash_tool_patterns: [],
		zero_access_paths: [],
		read_only_paths: [],
		no_delete_paths: [],
		warnings: [],
	};
}

export default function damage_control_extension(pi: ExtensionAPI) {
	let active_rules: ActiveRules = empty_rules();

	const load_active_rules = async (ctx: ExtensionContext) => {
		const result = await load_rules(ctx.cwd, import.meta.url);
		active_rules = result.rules;

		const summary = format_rule_summary(active_rules);
		ctx.ui.setStatus(DAMAGE_CONTROL_STATUS_KEY, `🛡 ${summary}`);

		const loaded_labels = result.stats.loaded_sources.map((source) => source.kind).join(", ");
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

	pi.on("session_start", async (_event, ctx) => {
		await load_active_rules(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		await load_active_rules(ctx);
	});

	pi.on("tool_call", async (event, ctx) => {
		const result = evaluate_tool_call(event, ctx.cwd, active_rules);
		if (!result.violation) {
			return { block: false };
		}

		if (result.confirmation_required) {
			return handle_confirmation(event, ctx, result.violation, pi);
		}

		const block_reason = format_block_reason(result.violation);
		ctx.ui.notify(`🛑 Damage-Control blocked ${event.toolName}: ${result.violation.reason}`, "warning");
		ctx.ui.setStatus(DAMAGE_CONTROL_STATUS_KEY, `⚠ ${result.violation.reason}`);
		append_log_entry(pi, event, result.violation, "blocked");
		return {
			block: true,
			reason: block_reason,
		};
	});
}

async function handle_confirmation(
	event: ToolCallEvent,
	ctx: ExtensionContext,
	violation: PolicyViolation,
	pi: ExtensionAPI,
): Promise<{ block: boolean; reason?: string }> {
	if (!ctx.hasUI) {
		const reason =
			`🛑 BLOCKED by Damage-Control: ${violation.reason}. ` +
			"Rule action is 'ask', but interactive UI is unavailable for confirmation.\n\n" +
			DAMAGE_CONTROL_BLOCK_INSTRUCTION;
		append_log_entry(pi, event, violation, "blocked");
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
		const reason = `🛑 BLOCKED by Damage-Control: ${violation.reason} (denied by user).\n\n${DAMAGE_CONTROL_BLOCK_INSTRUCTION}`;
		ctx.ui.setStatus(DAMAGE_CONTROL_STATUS_KEY, `⚠ ${violation.reason}`);
		return { block: true, reason };
	}

	append_log_entry(pi, event, violation, "confirmed_by_user");
	ctx.ui.notify(`🛡 Damage-Control approved ${event.toolName} after confirmation.`, "info");
	ctx.ui.setStatus(DAMAGE_CONTROL_STATUS_KEY, "🛡 confirmation approved");
	return { block: false };
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

function describe_tool_input(event: ToolCallEvent): string {
	if (isToolCallEventType("bash", event)) {
		return truncate_preview(event.input.command, 240);
	}

	if (isToolCallEventType("read", event) || isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
		return truncate_preview(event.input.path, 240);
	}

	return truncate_preview(safe_json(event.input), 240);
}

function safe_json(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return "[unserializable input]";
	}
}
