import type { ModelUsageEntry, SessionStats, ToolTally } from "./types.js";

export function create_stats(): SessionStats {
	return {
		session_started_at: null,
		tool_tallies: new Map(),
		total_tool_calls: 0,
		total_tool_errors: 0,
		turn_count: 0,
		agent_loop_count: 0,
		user_prompt_count: 0,
		user_bash_count: 0,
		compaction_count: 0,
		model_history: [],
	};
}

/**
 * Reconstruct session stats from session entries.
 *
 * Walks the current branch of session entries and counts:
 * - tool results (from message entries with role "toolResult")
 * - turns (from assistant message entries)
 * - user prompts (from user message entries)
 * - user bash commands (from bashExecution message entries)
 * - model changes (from model_change entries)
 * - compactions (from compaction entries)
 *
 * Agent loops are estimated: each user message followed by assistant activity
 * counts as one loop.
 */
export function reconstruct_stats(
	branch_entries: Array<{ type: string; timestamp: string; [key: string]: unknown }>,
	current_model?: { id: string; name: string; provider: string } | undefined,
): SessionStats {
	const stats = create_stats();

	// Session start time = first entry timestamp
	if (branch_entries.length > 0) {
		stats.session_started_at = branch_entries[0].timestamp;
	}

	let last_was_user = false;

	for (const entry of branch_entries) {
		if (entry.type === "message") {
			const message = (entry as { message: { role: string; [key: string]: unknown } }).message;
			if (!message) continue;

			switch (message.role) {
				case "toolResult": {
					const tool_msg = message as { toolName: string; isError: boolean };
					record_tool_result(stats, tool_msg.toolName, tool_msg.isError);
					break;
				}
				case "assistant": {
					stats.turn_count += 1;
					if (last_was_user) {
						stats.agent_loop_count += 1;
						last_was_user = false;
					}
					break;
				}
				case "user": {
					stats.user_prompt_count += 1;
					last_was_user = true;
					break;
				}
				case "bashExecution": {
					stats.user_bash_count += 1;
					break;
				}
			}
		} else if (entry.type === "model_change") {
			const model_entry = entry as { modelId: string; provider: string };
			record_model_select(stats, model_entry.modelId, model_entry.modelId, model_entry.provider);
		} else if (entry.type === "compaction") {
			stats.compaction_count += 1;
		}
	}

	// Seed current model if no model_change entries were found
	if (stats.model_history.length === 0 && current_model) {
		record_model_select(stats, current_model.id, current_model.name, current_model.provider);
	}

	// If model_change entries exist but lack a human-friendly name,
	// try to fix the current model's name from ctx.model
	if (current_model && stats.model_history.length > 0) {
		const last = stats.model_history[stats.model_history.length - 1];
		if (last.model_id === current_model.id && last.model_name === last.model_id) {
			last.model_name = current_model.name;
		}
	}

	return stats;
}

export function record_tool_result(stats: SessionStats, tool_name: string, is_error: boolean): void {
	let tally = stats.tool_tallies.get(tool_name);
	if (!tally) {
		tally = { calls: 0, errors: 0 };
		stats.tool_tallies.set(tool_name, tally);
	}
	tally.calls += 1;
	stats.total_tool_calls += 1;
	if (is_error) {
		tally.errors += 1;
		stats.total_tool_errors += 1;
	}
}

export function record_model_select(stats: SessionStats, model_id: string, model_name: string, provider: string): void {
	stats.model_history.push({
		model_id,
		model_name,
		provider,
		selected_at: new Date().toISOString(),
	});
}

export function get_session_duration_ms(stats: SessionStats): number | null {
	if (!stats.session_started_at) return null;
	const start = new Date(stats.session_started_at).getTime();
	if (Number.isNaN(start)) return null;
	return Date.now() - start;
}

export function get_session_duration_label(stats: SessionStats): string {
	const ms = get_session_duration_ms(stats);
	if (ms === null) return "—";
	return format_duration_ms(ms);
}

export function format_duration_ms(ms: number): string {
	const total_seconds = Math.floor(ms / 1000);
	const hours = Math.floor(total_seconds / 3600);
	const minutes = Math.floor((total_seconds % 3600) / 60);
	const seconds = total_seconds % 60;

	if (hours > 0) {
		return `${hours}h ${pad2(minutes)}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${pad2(seconds)}s`;
	}
	return `${seconds}s`;
}

function pad2(n: number): string {
	return `${n}`.padStart(2, "0");
}

export function get_sorted_tool_tallies(stats: SessionStats): Array<[string, ToolTally]> {
	const entries = Array.from(stats.tool_tallies.entries());
	entries.sort((a, b) => b[1].calls - a[1].calls);
	return entries;
}

export function get_current_model(stats: SessionStats): ModelUsageEntry | null {
	if (stats.model_history.length === 0) return null;
	return stats.model_history[stats.model_history.length - 1];
}

export function get_unique_models_used(stats: SessionStats): ModelUsageEntry[] {
	const seen = new Set<string>();
	const unique: ModelUsageEntry[] = [];
	for (const entry of stats.model_history) {
		if (!seen.has(entry.model_id)) {
			seen.add(entry.model_id);
			unique.push(entry);
		}
	}
	return unique;
}
