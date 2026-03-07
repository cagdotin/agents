import { describe, expect, it } from "vitest";
import {
	format_duration_ms,
	get_current_model,
	get_session_duration_label,
	get_sorted_tool_tallies,
	get_unique_models_used,
	reconstruct_stats,
} from "../tracker.js";

// ── helpers for building fake session entries ────────────────

function message_entry(
	message: { role: string; [key: string]: unknown },
	timestamp = "2026-03-07T10:00:00Z",
): { type: string; timestamp: string; message: { role: string; [key: string]: unknown } } {
	return { type: "message", timestamp, message };
}

function user_entry(timestamp?: string) {
	return message_entry({ role: "user", content: "hello", timestamp: Date.now() }, timestamp);
}

function assistant_entry(timestamp?: string) {
	return message_entry(
		{
			role: "assistant",
			content: [],
			model: "test",
			provider: "test",
			usage: {},
			stopReason: "stop",
			timestamp: Date.now(),
		},
		timestamp,
	);
}

function tool_result_entry(tool_name: string, is_error = false, timestamp?: string) {
	return message_entry(
		{ role: "toolResult", toolName: tool_name, isError: is_error, content: [], timestamp: Date.now() },
		timestamp,
	);
}

function bash_execution_entry(timestamp?: string) {
	return message_entry(
		{ role: "bashExecution", command: "ls", output: "", exitCode: 0, cancelled: false, timestamp: Date.now() },
		timestamp,
	);
}

function model_change_entry(model_id: string, provider: string, timestamp = "2026-03-07T10:00:00Z") {
	return { type: "model_change", timestamp, modelId: model_id, provider, id: "x", parentId: null };
}

function compaction_entry(timestamp = "2026-03-07T10:00:00Z") {
	return {
		type: "compaction",
		timestamp,
		summary: "compacted",
		firstKeptEntryId: "x",
		tokensBefore: 1000,
		id: "x",
		parentId: null,
	};
}

// ── tests ────────────────────────────────────────────────────

describe("reconstruct_stats", () => {
	it("returns zeroed stats for empty branch", () => {
		const stats = reconstruct_stats([]);
		expect(stats.total_tool_calls).toBe(0);
		expect(stats.turn_count).toBe(0);
		expect(stats.user_prompt_count).toBe(0);
		expect(stats.session_started_at).toBeNull();
	});

	it("sets session start time from first entry", () => {
		const stats = reconstruct_stats([user_entry("2026-03-07T09:00:00Z")]);
		expect(stats.session_started_at).toBe("2026-03-07T09:00:00Z");
	});

	it("counts tool results by tool name", () => {
		const entries = [
			tool_result_entry("bash"),
			tool_result_entry("bash"),
			tool_result_entry("read"),
			tool_result_entry("edit", true),
		];
		const stats = reconstruct_stats(entries);

		expect(stats.total_tool_calls).toBe(4);
		expect(stats.total_tool_errors).toBe(1);
		expect(stats.tool_tallies.get("bash")).toEqual({ calls: 2, errors: 0 });
		expect(stats.tool_tallies.get("read")).toEqual({ calls: 1, errors: 0 });
		expect(stats.tool_tallies.get("edit")).toEqual({ calls: 1, errors: 1 });
	});

	it("counts assistant messages as turns", () => {
		const entries = [user_entry(), assistant_entry(), user_entry(), assistant_entry(), assistant_entry()];
		const stats = reconstruct_stats(entries);
		expect(stats.turn_count).toBe(3);
	});

	it("counts user messages as prompts", () => {
		const entries = [user_entry(), assistant_entry(), user_entry()];
		const stats = reconstruct_stats(entries);
		expect(stats.user_prompt_count).toBe(2);
	});

	it("counts bash execution messages", () => {
		const entries = [bash_execution_entry(), bash_execution_entry()];
		const stats = reconstruct_stats(entries);
		expect(stats.user_bash_count).toBe(2);
	});

	it("counts agent loops (user → assistant transitions)", () => {
		// user → assistant = 1 loop, user → assistant → assistant = still 1 loop
		const entries = [
			user_entry(),
			assistant_entry(),
			tool_result_entry("bash"),
			assistant_entry(),
			user_entry(),
			assistant_entry(),
		];
		const stats = reconstruct_stats(entries);
		expect(stats.agent_loop_count).toBe(2);
	});

	it("tracks model changes", () => {
		const entries = [
			model_change_entry("claude-sonnet-4", "anthropic"),
			user_entry(),
			model_change_entry("gpt-4o", "openai"),
		];
		const stats = reconstruct_stats(entries);
		expect(stats.model_history).toHaveLength(2);
		expect(stats.model_history[0].model_id).toBe("claude-sonnet-4");
		expect(stats.model_history[1].model_id).toBe("gpt-4o");
	});

	it("counts compaction entries", () => {
		const entries = [compaction_entry(), user_entry(), compaction_entry()];
		const stats = reconstruct_stats(entries);
		expect(stats.compaction_count).toBe(2);
	});

	it("seeds current model when no model_change entries exist", () => {
		const entries = [user_entry(), assistant_entry()];
		const stats = reconstruct_stats(entries, { id: "claude-opus", name: "Claude Opus", provider: "anthropic" });
		expect(stats.model_history).toHaveLength(1);
		expect(stats.model_history[0].model_name).toBe("Claude Opus");
	});

	it("does not duplicate model if model_change entries exist", () => {
		const entries = [model_change_entry("claude-opus", "anthropic"), user_entry()];
		const stats = reconstruct_stats(entries, { id: "claude-opus", name: "Claude Opus", provider: "anthropic" });
		expect(stats.model_history).toHaveLength(1);
	});

	it("fixes model name from ctx.model for current model", () => {
		const entries = [model_change_entry("claude-opus", "anthropic")];
		// model_change only has modelId, not a friendly name — reconstruct uses modelId as name
		// but we fix it with the current model's name if it matches
		const stats = reconstruct_stats(entries, { id: "claude-opus", name: "Claude Opus 4.6", provider: "anthropic" });
		expect(stats.model_history[0].model_name).toBe("Claude Opus 4.6");
	});

	it("handles a realistic session", () => {
		const entries = [
			model_change_entry("claude-sonnet-4", "anthropic", "2026-03-07T09:00:00Z"),
			user_entry("2026-03-07T09:01:00Z"),
			assistant_entry("2026-03-07T09:01:05Z"),
			tool_result_entry("read", false, "2026-03-07T09:01:06Z"),
			tool_result_entry("bash", false, "2026-03-07T09:01:07Z"),
			assistant_entry("2026-03-07T09:01:10Z"),
			tool_result_entry("edit", false, "2026-03-07T09:01:11Z"),
			tool_result_entry("bash", true, "2026-03-07T09:01:12Z"),
			assistant_entry("2026-03-07T09:01:15Z"),
			user_entry("2026-03-07T09:02:00Z"),
			assistant_entry("2026-03-07T09:02:05Z"),
			bash_execution_entry("2026-03-07T09:03:00Z"),
		];

		const stats = reconstruct_stats(entries, { id: "claude-sonnet-4", name: "Claude 4 Sonnet", provider: "anthropic" });

		expect(stats.session_started_at).toBe("2026-03-07T09:00:00Z");
		expect(stats.total_tool_calls).toBe(4);
		expect(stats.total_tool_errors).toBe(1);
		expect(stats.turn_count).toBe(4);
		expect(stats.agent_loop_count).toBe(2);
		expect(stats.user_prompt_count).toBe(2);
		expect(stats.user_bash_count).toBe(1);
		expect(stats.model_history).toHaveLength(1);
		expect(stats.model_history[0].model_name).toBe("Claude 4 Sonnet");
		expect(stats.tool_tallies.get("bash")).toEqual({ calls: 2, errors: 1 });
		expect(stats.tool_tallies.get("read")).toEqual({ calls: 1, errors: 0 });
		expect(stats.tool_tallies.get("edit")).toEqual({ calls: 1, errors: 0 });
	});
});

describe("format_duration_ms", () => {
	it("formats seconds only", () => {
		expect(format_duration_ms(0)).toBe("0s");
		expect(format_duration_ms(5_000)).toBe("5s");
		expect(format_duration_ms(59_000)).toBe("59s");
	});

	it("formats minutes and seconds", () => {
		expect(format_duration_ms(60_000)).toBe("1m 00s");
		expect(format_duration_ms(90_000)).toBe("1m 30s");
		expect(format_duration_ms(754_000)).toBe("12m 34s");
	});

	it("formats hours and minutes", () => {
		expect(format_duration_ms(3_600_000)).toBe("1h 00m");
		expect(format_duration_ms(5_430_000)).toBe("1h 30m");
		expect(format_duration_ms(7_200_000)).toBe("2h 00m");
	});
});

describe("get_session_duration_label", () => {
	it("returns dash when no start time", () => {
		const stats = reconstruct_stats([]);
		expect(get_session_duration_label(stats)).toBe("—");
	});

	it("returns formatted duration when started", () => {
		const stats = reconstruct_stats([user_entry(new Date(Date.now() - 90_000).toISOString())]);
		const label = get_session_duration_label(stats);
		expect(label).toMatch(/^1m \d{2}s$/);
	});
});

describe("get_sorted_tool_tallies", () => {
	it("returns empty array when no tools", () => {
		const stats = reconstruct_stats([]);
		expect(get_sorted_tool_tallies(stats)).toEqual([]);
	});

	it("sorts by call count descending", () => {
		const entries = [
			tool_result_entry("read"),
			tool_result_entry("bash"),
			tool_result_entry("bash"),
			tool_result_entry("bash"),
			tool_result_entry("edit"),
			tool_result_entry("edit"),
		];
		const sorted = get_sorted_tool_tallies(reconstruct_stats(entries));
		expect(sorted.map(([name]) => name)).toEqual(["bash", "edit", "read"]);
		expect(sorted[0][1].calls).toBe(3);
	});
});

describe("get_current_model", () => {
	it("returns null when no models", () => {
		expect(get_current_model(reconstruct_stats([]))).toBeNull();
	});

	it("returns last model in history", () => {
		const entries = [model_change_entry("claude-sonnet-4", "anthropic"), model_change_entry("gpt-4o", "openai")];
		const current = get_current_model(reconstruct_stats(entries));
		expect(current?.model_id).toBe("gpt-4o");
	});
});

describe("get_unique_models_used", () => {
	it("deduplicates by model_id", () => {
		const entries = [
			model_change_entry("claude-sonnet-4", "anthropic"),
			model_change_entry("gpt-4o", "openai"),
			model_change_entry("claude-sonnet-4", "anthropic"),
		];
		const unique = get_unique_models_used(reconstruct_stats(entries));
		expect(unique).toHaveLength(2);
		expect(unique[0].model_id).toBe("claude-sonnet-4");
		expect(unique[1].model_id).toBe("gpt-4o");
	});
});
