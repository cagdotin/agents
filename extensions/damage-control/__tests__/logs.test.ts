import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { get_recent_damage_control_rows } from "../logs.js";

function make_context(entries: unknown[]): ExtensionContext {
	return {
		sessionManager: {
			getBranch: () => entries,
		},
	} as unknown as ExtensionContext;
}

function make_log_entry(data: Record<string, unknown>) {
	return {
		type: "custom",
		customType: "damage-control-log",
		data,
	};
}

describe("get_recent_damage_control_rows", () => {
	it("returns latest entries first and honors limit", () => {
		const entries = [
			make_log_entry({
				timestamp: "2026-03-07T10:00:00.000Z",
				action: "blocked",
				tool_name: "bash",
				reason: "first",
				rule_type: "bash_pattern",
				rule_source: "bundled",
				input_preview: "echo first",
			}),
			make_log_entry({
				timestamp: "2026-03-07T10:01:00.000Z",
				action: "blocked_by_user",
				tool_name: "bash",
				reason: "second",
				rule_type: "bash_pattern",
				rule_source: "project",
				input_preview: "echo second",
			}),
			make_log_entry({
				timestamp: "2026-03-07T10:02:00.000Z",
				action: "confirmed_by_user",
				tool_name: "write",
				reason: "third",
				rule_type: "read_only",
				rule_source: "global",
				input_preview: "config/prod.yaml",
			}),
		];

		const rows = get_recent_damage_control_rows(make_context(entries), 2);
		expect(rows).toHaveLength(2);
		expect(rows[0]?.reason).toBe("third");
		expect(rows[1]?.reason).toBe("second");
	});

	it("skips malformed log entries", () => {
		const entries = [
			make_log_entry({
				timestamp: "2026-03-07T10:00:00.000Z",
				action: "blocked",
				tool_name: "bash",
				reason: "valid",
				rule_type: "bash_pattern",
				rule_source: "bundled",
				input_preview: "echo valid",
			}),
			make_log_entry({
				timestamp: "not-a-date",
				action: "blocked",
				tool_name: "bash",
				reason: "bad timestamp",
				rule_type: "bash_pattern",
				rule_source: "bundled",
				input_preview: "echo invalid",
			}),
			make_log_entry({
				timestamp: "2026-03-07T10:02:00.000Z",
				action: "unknown_action",
				tool_name: "bash",
				reason: "bad action",
				rule_type: "bash_pattern",
				rule_source: "bundled",
				input_preview: "echo invalid",
			}),
		];

		const rows = get_recent_damage_control_rows(make_context(entries), 10);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.reason).toBe("valid");
	});

	it("ignores unrelated branch entries", () => {
		const entries = [
			{
				type: "message",
				message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
			},
			{
				type: "custom",
				customType: "something-else",
				data: { any: "value" },
			},
			make_log_entry({
				timestamp: "2026-03-07T10:03:00.000Z",
				action: "blocked",
				tool_name: "edit",
				reason: "rule",
				rule_type: "read_only",
				rule_source: "project",
				input_preview: "file.txt",
			}),
		];

		const rows = get_recent_damage_control_rows(make_context(entries), 10);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.tool_name).toBe("edit");
	});
});
