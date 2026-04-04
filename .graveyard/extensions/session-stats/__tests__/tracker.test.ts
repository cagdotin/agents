import { describe, expect, it } from "vitest";
import { build_plain_text_summary } from "../panel.js";
import {
	categorize_file,
	extract_bash_programs,
	extract_tool_call_detail,
	format_duration_ms,
	get_current_model,
	get_session_duration_label,
	get_sorted_tool_tallies,
	get_unique_models_used,
	group_files_by_category,
	reconstruct_stats,
	split_command_quote_aware,
	to_relative_path,
} from "../tracker.js";
import type { ToolDetails } from "../types.js";

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

function assistant_with_tool_calls(
	tool_calls: Array<{ name: string; arguments: Record<string, unknown> }>,
	timestamp?: string,
) {
	return message_entry(
		{
			role: "assistant",
			content: tool_calls.map((tc, i) => ({
				type: "toolCall",
				id: `tc-${i}`,
				name: tc.name,
				arguments: tc.arguments,
			})),
			model: "test",
			provider: "test",
			usage: {},
			stopReason: "stop",
			timestamp: Date.now(),
		},
		timestamp,
	);
}

function create_empty_tool_details(): ToolDetails {
	return {
		bash_programs: new Map(),
		read_files: [],
		edit_files: [],
		write_files: [],
		expertise_actions: new Map(),
		todo_actions: new Map(),
		read_timeline_events: [],
		edit_timeline_events: [],
		write_timeline_events: [],
	};
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

// ── Phase 2: Tool detail extraction ─────────────────────────

describe("split_command_quote_aware", () => {
	it("splits on && outside quotes", () => {
		expect(split_command_quote_aware("cd src && bun test")).toEqual(["cd src ", " bun test"]);
	});

	it("does NOT split on ; inside double quotes", () => {
		const segments = split_command_quote_aware('node -e "const x = 1; console.log(x)"');
		expect(segments).toHaveLength(1);
		expect(segments[0]).toContain("node");
	});

	it("does NOT split on | inside single quotes", () => {
		const segments = split_command_quote_aware("grep 'foo|bar' file.txt | sort");
		expect(segments).toHaveLength(2);
		expect(segments[0].trim()).toBe("grep 'foo|bar' file.txt");
	});

	it("handles escaped quotes inside double quotes", () => {
		const segments = split_command_quote_aware('echo "he said \\"hello\\""; pwd');
		expect(segments).toHaveLength(2);
	});

	it("handles mixed quote types", () => {
		const segments = split_command_quote_aware(`echo "it's fine" && echo 'he said "hi"'`);
		expect(segments).toHaveLength(2);
	});

	it("handles unclosed quotes gracefully", () => {
		const segments = split_command_quote_aware('echo "unterminated');
		expect(segments).toHaveLength(1);
	});
});

describe("extract_bash_programs", () => {
	it("extracts a simple command", () => {
		expect(extract_bash_programs("git status")).toEqual(["git"]);
	});

	it("extracts from chained && commands", () => {
		expect(extract_bash_programs("cd src && bun test")).toEqual(["cd", "bun"]);
	});

	it("extracts from || chains", () => {
		expect(extract_bash_programs("cat file.txt || echo fallback")).toEqual(["cat", "echo"]);
	});

	it("extracts from piped commands", () => {
		expect(extract_bash_programs("grep -r pattern | sort | uniq -c")).toEqual(["grep", "sort", "uniq"]);
	});

	it("extracts from semicolon-separated commands", () => {
		expect(extract_bash_programs("ls; pwd; whoami")).toEqual(["ls", "pwd", "whoami"]);
	});

	it("skips env var prefixes", () => {
		expect(extract_bash_programs("NODE_ENV=production bun run build")).toEqual(["bun"]);
	});

	it("skips multiple env var prefixes", () => {
		expect(extract_bash_programs("FOO=1 BAR=2 node script.js")).toEqual(["node"]);
	});

	it("takes basename from paths", () => {
		expect(extract_bash_programs("/usr/bin/env node")).toEqual(["env"]);
		expect(extract_bash_programs("./node_modules/.bin/vitest")).toEqual(["vitest"]);
	});

	it("returns empty array for empty/whitespace input", () => {
		expect(extract_bash_programs("")).toEqual([]);
		expect(extract_bash_programs("   ")).toEqual([]);
	});

	it("handles complex one-liners", () => {
		const result = extract_bash_programs("cd /tmp && git clone repo.git; cd repo && bun install | tee log.txt");
		expect(result).toEqual(["cd", "git", "cd", "bun", "tee"]);
	});

	// ── quote-aware tests (phase 2 fixes) ────────────────

	it("extracts only the program from node -e with inline JS", () => {
		expect(extract_bash_programs('node -e "const x = JSON.parse(raw); console.log(typeof x)"')).toEqual(["node"]);
	});

	it("extracts only the program from python -c with inline code", () => {
		expect(extract_bash_programs('python -c "import json; print(json.loads(x))"')).toEqual(["python"]);
	});

	it("extracts only the program from bun -e with inline JS", () => {
		expect(extract_bash_programs('bun -e "const words = text.split(/\\s+/); console.log(words.length)"')).toEqual([
			"bun",
		]);
	});

	it("handles grep patterns with special chars in quotes", () => {
		expect(extract_bash_programs('grep -r "YAML\\.parse\\(" src/')).toEqual(["grep"]);
		expect(extract_bash_programs('grep -r "RESOURCE_REQUIRED_FIELDS" docs/')).toEqual(["grep"]);
	});

	it("handles pipes after quoted grep patterns", () => {
		expect(extract_bash_programs('grep -rn "extract_frontmatter" src/ | sort | head -20')).toEqual([
			"grep",
			"sort",
			"head",
		]);
	});

	it("handles rg with quoted patterns piped", () => {
		expect(extract_bash_programs('rg "RESOURCE_FIELD_HINTS" src/ --json | head -5')).toEqual(["rg", "head"]);
	});

	it("rejects tokens with parens as program names", () => {
		// Even if something leaks through, parens are not valid program names
		expect(extract_bash_programs("console.log(x)")).toEqual([]);
	});

	it("rejects tokens with quotes as program names", () => {
		expect(extract_bash_programs('"')).toEqual([]);
	});

	it("rejects tokens with backslashes as program names", () => {
		expect(extract_bash_programs("YAML\\.parse\\(")).toEqual([]);
	});

	it("handles multiline node -e scripts without false positives", () => {
		const cmd =
			"node -e \"const RESOURCE_REQUIRED_FIELDS = ['title']; push_resource_frontmatter_errors(errors); console.log('done');\"";
		expect(extract_bash_programs(cmd)).toEqual(["node"]);
	});

	it("handles real compound commands with quotes correctly", () => {
		expect(extract_bash_programs('echo "hello; world" && grep "foo|bar" file | sort')).toEqual([
			"echo",
			"grep",
			"sort",
		]);
	});
});

describe("to_relative_path", () => {
	it("returns relative paths unchanged", () => {
		expect(to_relative_path("src/index.ts")).toBe("src/index.ts");
		expect(to_relative_path("docs/README.md")).toBe("docs/README.md");
		expect(to_relative_path("package.json")).toBe("package.json");
	});

	it("converts absolute paths under cwd to relative", () => {
		const cwd = process.cwd();
		expect(to_relative_path(`${cwd}/src/index.ts`)).toBe("src/index.ts");
		expect(to_relative_path(`${cwd}/docs/README.md`)).toBe("docs/README.md");
	});

	it("converts absolute paths outside cwd to relative with ../", () => {
		const result = to_relative_path("/tmp/some-other-project/file.ts");
		expect(result).toContain("..");
		expect(result).not.toBe("/tmp/some-other-project/file.ts");
	});

	it("handles cwd itself", () => {
		const cwd = process.cwd();
		// relative("foo", "foo") returns "" — we fall back to original
		expect(to_relative_path(cwd)).toBe(cwd);
	});
});

describe("categorize_file", () => {
	it("categorizes docs/ prefix as docs", () => {
		expect(categorize_file("docs/ARCHITECTURE.md")).toBe("docs");
	});

	it("categorizes .md files as docs", () => {
		expect(categorize_file("CHANGELOG.md")).toBe("docs");
	});

	it("categorizes README files as docs", () => {
		expect(categorize_file("README.md")).toBe("docs");
		expect(categorize_file("README")).toBe("docs");
	});

	it("categorizes AGENTS.md as docs", () => {
		expect(categorize_file("AGENTS.md")).toBe("docs");
	});

	it("categorizes skills/ prefix as skills", () => {
		expect(categorize_file("skills/plan/SKILL.md")).toBe("skills");
	});

	it("categorizes SKILL.md anywhere as skills", () => {
		expect(categorize_file("extensions/foo/SKILL.md")).toBe("skills");
	});

	it("categorizes __tests__/ files as tests", () => {
		expect(categorize_file("extensions/foo/__tests__/bar.test.ts")).toBe("tests");
	});

	it("categorizes .test.ts files as tests", () => {
		expect(categorize_file("src/utils.test.ts")).toBe("tests");
	});

	it("categorizes .spec.js files as tests", () => {
		expect(categorize_file("lib/thing.spec.js")).toBe("tests");
	});

	it("categorizes everything else as code", () => {
		expect(categorize_file("extensions/session-stats/tracker.ts")).toBe("code");
		expect(categorize_file("src/index.ts")).toBe("code");
		expect(categorize_file("package.json")).toBe("code");
	});
});

describe("group_files_by_category", () => {
	it("groups mixed paths into correct categories", () => {
		const paths = [
			"src/index.ts",
			"docs/README.md",
			"skills/plan/SKILL.md",
			"src/__tests__/util.test.ts",
			"AGENTS.md",
			"src/utils.ts",
		];
		const grouped = group_files_by_category(paths);
		expect(grouped.get("docs")).toEqual(["AGENTS.md", "docs/README.md"]);
		expect(grouped.get("skills")).toEqual(["skills/plan/SKILL.md"]);
		expect(grouped.get("tests")).toEqual(["src/__tests__/util.test.ts"]);
		expect(grouped.get("code")).toEqual(["src/index.ts", "src/utils.ts"]);
	});

	it("returns empty map for empty input", () => {
		const grouped = group_files_by_category([]);
		expect(grouped.size).toBe(0);
	});

	it("sorts files within each category", () => {
		const paths = ["src/z.ts", "src/a.ts", "src/m.ts"];
		const grouped = group_files_by_category(paths);
		expect(grouped.get("code")).toEqual(["src/a.ts", "src/m.ts", "src/z.ts"]);
	});
});

describe("extract_tool_call_detail", () => {
	it("extracts bash program counts", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "Bash", { command: "git status && bun test" });
		extract_tool_call_detail(details, "Bash", { command: "git log" });
		expect(details.bash_programs.get("git")).toBe(2);
		expect(details.bash_programs.get("bun")).toBe(1);
	});

	it("extracts unique Read file paths", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "Read", { path: "src/index.ts" });
		extract_tool_call_detail(details, "Read", { path: "src/index.ts" }); // duplicate
		extract_tool_call_detail(details, "Read", { path: "docs/README.md" });
		expect(details.read_files).toEqual(["src/index.ts", "docs/README.md"]);
	});

	it("extracts unique Edit file paths", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "Edit", { path: "src/index.ts" });
		extract_tool_call_detail(details, "Edit", { path: "src/index.ts" });
		expect(details.edit_files).toEqual(["src/index.ts"]);
	});

	it("extracts unique Write file paths", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "Write", { path: "new-file.ts" });
		expect(details.write_files).toEqual(["new-file.ts"]);
	});

	it("extracts expertise actions with domains", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "expertise", { action: "get", domain: "auth" });
		extract_tool_call_detail(details, "expertise", { action: "get", domain: "db" });
		extract_tool_call_detail(details, "expertise", { action: "reflect", domain: "auth" });
		expect(details.expertise_actions.get("get")).toEqual(["auth", "db"]);
		expect(details.expertise_actions.get("reflect")).toEqual(["auth"]);
	});

	it("extracts todo action counts", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "todo", { action: "create" });
		extract_tool_call_detail(details, "todo", { action: "create" });
		extract_tool_call_detail(details, "todo", { action: "list" });
		expect(details.todo_actions.get("create")).toBe(2);
		expect(details.todo_actions.get("list")).toBe(1);
	});

	it("normalizes absolute paths to relative for Read", () => {
		const details = create_empty_tool_details();
		const cwd = process.cwd();
		extract_tool_call_detail(details, "Read", { path: `${cwd}/src/index.ts` });
		expect(details.read_files).toEqual(["src/index.ts"]);
	});

	it("normalizes absolute paths to relative for Edit", () => {
		const details = create_empty_tool_details();
		const cwd = process.cwd();
		extract_tool_call_detail(details, "Edit", { path: `${cwd}/src/index.ts` });
		expect(details.edit_files).toEqual(["src/index.ts"]);
	});

	it("normalizes absolute paths to relative for Write", () => {
		const details = create_empty_tool_details();
		const cwd = process.cwd();
		extract_tool_call_detail(details, "Write", { path: `${cwd}/src/new-file.ts` });
		expect(details.write_files).toEqual(["src/new-file.ts"]);
	});

	it("deduplicates absolute and relative paths referring to the same file", () => {
		const details = create_empty_tool_details();
		const cwd = process.cwd();
		extract_tool_call_detail(details, "Read", { path: "src/index.ts" });
		extract_tool_call_detail(details, "Read", { path: `${cwd}/src/index.ts` });
		expect(details.read_files).toEqual(["src/index.ts"]);
	});

	it("handles case-insensitive tool names", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "bash", { command: "ls" });
		extract_tool_call_detail(details, "BASH", { command: "pwd" });
		expect(details.bash_programs.get("ls")).toBe(1);
		expect(details.bash_programs.get("pwd")).toBe(1);
	});

	it("skips missing or invalid arguments", () => {
		const details = create_empty_tool_details();
		extract_tool_call_detail(details, "Bash", {} as Record<string, string>);
		extract_tool_call_detail(details, "Read", {} as Record<string, string>);
		expect(details.bash_programs.size).toBe(0);
		expect(details.read_files).toEqual([]);
	});
});

describe("absolute path normalization in reconstruct_stats", () => {
	it("normalizes absolute paths to relative in file lists and timeline events", () => {
		const cwd = process.cwd();
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: `${cwd}/docs/README.md` } },
					{ name: "Edit", arguments: { path: `${cwd}/src/index.ts`, oldText: "a", newText: "b" } },
					{ name: "Write", arguments: { path: `${cwd}/src/new-file.ts`, content: "hello" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Edit"),
			tool_result_entry("Write"),
		];
		const stats = reconstruct_stats(entries);

		// Unique file lists should have relative paths
		expect(stats.tool_details.read_files).toEqual(["docs/README.md"]);
		expect(stats.tool_details.edit_files).toEqual(["src/index.ts"]);
		expect(stats.tool_details.write_files).toEqual(["src/new-file.ts"]);

		// Timeline events should have relative paths
		const read_ops = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");
		expect(read_ops[0].path).toBe("docs/README.md");
		const edit_ops = stats.tool_details.edit_timeline_events.filter((e) => e.kind === "file-op");
		expect(edit_ops[0].path).toBe("src/index.ts");
		const write_ops = stats.tool_details.write_timeline_events.filter((e) => e.kind === "file-op");
		expect(write_ops[0].path).toBe("src/new-file.ts");
	});
});

describe("reconstruct_stats with tool call arguments", () => {
	it("extracts bash programs from assistant tool calls", () => {
		const entries = [
			user_entry(),
			assistant_with_tool_calls([{ name: "Bash", arguments: { command: "git status" } }]),
			tool_result_entry("Bash"),
		];
		const stats = reconstruct_stats(entries);
		expect(stats.tool_details.bash_programs.get("git")).toBe(1);
	});

	it("extracts file paths from Read/Edit/Write tool calls", () => {
		const entries = [
			user_entry(),
			assistant_with_tool_calls([
				{ name: "Read", arguments: { path: "docs/README.md" } },
				{ name: "Edit", arguments: { path: "src/index.ts", oldText: "a", newText: "b" } },
				{ name: "Write", arguments: { path: "new-file.ts", content: "hello" } },
			]),
			tool_result_entry("Read"),
			tool_result_entry("Edit"),
			tool_result_entry("Write"),
		];
		const stats = reconstruct_stats(entries);
		expect(stats.tool_details.read_files).toEqual(["docs/README.md"]);
		expect(stats.tool_details.edit_files).toEqual(["src/index.ts"]);
		expect(stats.tool_details.write_files).toEqual(["new-file.ts"]);
	});

	it("handles multiple tool calls across multiple assistant messages", () => {
		const entries = [
			user_entry(),
			assistant_with_tool_calls([
				{ name: "Bash", arguments: { command: "git status" } },
				{ name: "Read", arguments: { path: "src/a.ts" } },
			]),
			tool_result_entry("Bash"),
			tool_result_entry("Read"),
			assistant_with_tool_calls([
				{ name: "Bash", arguments: { command: "git diff && bun test" } },
				{ name: "Edit", arguments: { path: "src/a.ts", oldText: "x", newText: "y" } },
			]),
			tool_result_entry("Bash"),
			tool_result_entry("Edit"),
		];
		const stats = reconstruct_stats(entries);
		expect(stats.tool_details.bash_programs.get("git")).toBe(2);
		expect(stats.tool_details.bash_programs.get("bun")).toBe(1);
		expect(stats.tool_details.read_files).toEqual(["src/a.ts"]);
		expect(stats.tool_details.edit_files).toEqual(["src/a.ts"]);
	});

	it("handles assistant message with no content array", () => {
		const entries = [
			user_entry(),
			message_entry({
				role: "assistant",
				content: undefined as unknown,
				model: "test",
				provider: "test",
				usage: {},
				stopReason: "stop",
				timestamp: Date.now(),
			}),
		];
		const stats = reconstruct_stats(entries);
		expect(stats.tool_details.bash_programs.size).toBe(0);
		expect(stats.turn_count).toBe(1);
	});
});

// ── Phase 3: Read timeline events ───────────────────────────

describe("read_timeline_events", () => {
	it("emits user markers and read events in branch order", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "docs/README.md" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Read", false, "2026-03-10T10:00:06Z"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/index.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read", false, "2026-03-10T10:01:06Z"),
		];
		const stats = reconstruct_stats(entries);
		const events = stats.tool_details.read_timeline_events;

		expect(events).toHaveLength(4);
		expect(events[0]).toEqual({
			kind: "user-marker",
			timestamp: "2026-03-10T10:00:00Z",
			user_message_index: 1,
		});
		expect(events[1]).toMatchObject({
			kind: "file-op",
			op_order: 1,
			path: "docs/README.md",
			category: "docs",
			user_message_index: 1,
		});
		expect(events[2]).toEqual({
			kind: "user-marker",
			timestamp: "2026-03-10T10:01:00Z",
			user_message_index: 2,
		});
		expect(events[3]).toMatchObject({
			kind: "file-op",
			op_order: 2,
			path: "src/index.ts",
			category: "code",
			user_message_index: 2,
		});
	});

	it("assigns op_order sequentially across all reads", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: "a.ts" } },
					{ name: "Read", arguments: { path: "b.ts" } },
					{ name: "Read", arguments: { path: "c.ts" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");

		expect(reads).toHaveLength(3);
		expect(reads[0].op_order).toBe(1);
		expect(reads[1].op_order).toBe(2);
		expect(reads[2].op_order).toBe(3);
	});

	it("marks repeat reads with is_repeat", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/index.ts" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Read"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/index.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");

		expect(reads[0].is_repeat).toBe(false);
		expect(reads[1].is_repeat).toBe(true);
	});

	it("assigns user_message_index 0 for reads before any user message", () => {
		// This can happen if assistant messages appear before the first user message
		// (e.g. system-injected tool calls)
		const entries = [
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "config.json" } }], "2026-03-10T10:00:00Z"),
			tool_result_entry("Read"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/app.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");

		expect(reads[0].user_message_index).toBe(0);
		expect(reads[1].user_message_index).toBe(1);
	});

	it("assigns correct categories to timeline read events", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: "docs/ARCHITECTURE.md" } },
					{ name: "Read", arguments: { path: "skills/plan/SKILL.md" } },
					{ name: "Read", arguments: { path: "extensions/foo/__tests__/bar.test.ts" } },
					{ name: "Read", arguments: { path: "extensions/foo/index.ts" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");

		expect(reads[0].category).toBe("docs");
		expect(reads[1].category).toBe("skills");
		expect(reads[2].category).toBe("tests");
		expect(reads[3].category).toBe("code");
	});

	it("preserves existing read_files unique list alongside timeline events", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: "a.ts" } },
					{ name: "Read", arguments: { path: "b.ts" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "a.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);

		// Unique list unchanged
		expect(stats.tool_details.read_files).toEqual(["a.ts", "b.ts"]);
		// Timeline has all 3 reads + 2 user markers
		expect(stats.tool_details.read_timeline_events).toHaveLength(5);
		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");
		expect(reads).toHaveLength(3);
	});

	it("handles session with no read calls — empty timeline", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Bash", arguments: { command: "ls" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Bash"),
		];
		const stats = reconstruct_stats(entries);
		const events = stats.tool_details.read_timeline_events;

		// Only user marker, no read events
		expect(events).toHaveLength(1);
		expect(events[0].kind).toBe("user-marker");
	});

	it("handles multiple reads in a multi-turn agent loop", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "docs/README.md" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Read"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: "src/a.ts" } },
					{ name: "Read", arguments: { path: "src/b.ts" } },
				],
				"2026-03-10T10:00:10Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Read"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/c.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const events = stats.tool_details.read_timeline_events;

		// user1, read1, read2, read3, user2, read4
		expect(events).toHaveLength(6);
		expect(events[0].kind).toBe("user-marker");
		expect(events[1]).toMatchObject({ kind: "file-op", op_order: 1, path: "docs/README.md" });
		expect(events[2]).toMatchObject({ kind: "file-op", op_order: 2, path: "src/a.ts" });
		expect(events[3]).toMatchObject({ kind: "file-op", op_order: 3, path: "src/b.ts" });
		expect(events[4].kind).toBe("user-marker");
		expect(events[5]).toMatchObject({ kind: "file-op", op_order: 4, path: "src/c.ts" });
	});
});

// ── Edit timeline events ────────────────────────────────────

describe("edit_timeline_events", () => {
	it("emits user markers and edit events in branch order", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[{ name: "Edit", arguments: { path: "src/index.ts", oldText: "a", newText: "b" } }],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Edit", false, "2026-03-10T10:00:06Z"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls(
				[{ name: "Edit", arguments: { path: "src/utils.ts", oldText: "x", newText: "y" } }],
				"2026-03-10T10:01:05Z",
			),
			tool_result_entry("Edit", false, "2026-03-10T10:01:06Z"),
		];
		const stats = reconstruct_stats(entries);
		const events = stats.tool_details.edit_timeline_events;

		expect(events).toHaveLength(4);
		expect(events[0]).toEqual({
			kind: "user-marker",
			timestamp: "2026-03-10T10:00:00Z",
			user_message_index: 1,
		});
		expect(events[1]).toMatchObject({
			kind: "file-op",
			op_order: 1,
			path: "src/index.ts",
			category: "code",
			user_message_index: 1,
			is_repeat: false,
		});
		expect(events[2]).toEqual({
			kind: "user-marker",
			timestamp: "2026-03-10T10:01:00Z",
			user_message_index: 2,
		});
		expect(events[3]).toMatchObject({
			kind: "file-op",
			op_order: 2,
			path: "src/utils.ts",
			category: "code",
			user_message_index: 2,
		});
	});

	it("marks repeat edits with is_repeat", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[{ name: "Edit", arguments: { path: "src/index.ts", oldText: "a", newText: "b" } }],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Edit"),
			assistant_with_tool_calls(
				[{ name: "Edit", arguments: { path: "src/index.ts", oldText: "b", newText: "c" } }],
				"2026-03-10T10:00:10Z",
			),
			tool_result_entry("Edit"),
		];
		const stats = reconstruct_stats(entries);
		const edits = stats.tool_details.edit_timeline_events.filter((e) => e.kind === "file-op");

		expect(edits).toHaveLength(2);
		expect(edits[0].is_repeat).toBe(false);
		expect(edits[1].is_repeat).toBe(true);
	});

	it("has independent op_order from read timeline", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: "src/a.ts" } },
					{ name: "Edit", arguments: { path: "src/a.ts", oldText: "x", newText: "y" } },
					{ name: "Read", arguments: { path: "src/b.ts" } },
					{ name: "Edit", arguments: { path: "src/b.ts", oldText: "p", newText: "q" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Edit"),
			tool_result_entry("Read"),
			tool_result_entry("Edit"),
		];
		const stats = reconstruct_stats(entries);

		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");
		const edits = stats.tool_details.edit_timeline_events.filter((e) => e.kind === "file-op");

		// Read and edit have independent ordering
		expect(reads[0].op_order).toBe(1);
		expect(reads[1].op_order).toBe(2);
		expect(edits[0].op_order).toBe(1);
		expect(edits[1].op_order).toBe(2);
	});

	it("preserves existing edit_files unique list alongside timeline events", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Edit", arguments: { path: "a.ts", oldText: "1", newText: "2" } },
					{ name: "Edit", arguments: { path: "b.ts", oldText: "3", newText: "4" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Edit"),
			tool_result_entry("Edit"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls(
				[{ name: "Edit", arguments: { path: "a.ts", oldText: "2", newText: "5" } }],
				"2026-03-10T10:01:05Z",
			),
			tool_result_entry("Edit"),
		];
		const stats = reconstruct_stats(entries);

		// Unique list unchanged
		expect(stats.tool_details.edit_files).toEqual(["a.ts", "b.ts"]);
		// Timeline has all 3 edits + 2 user markers
		expect(stats.tool_details.edit_timeline_events).toHaveLength(5);
		const edits = stats.tool_details.edit_timeline_events.filter((e) => e.kind === "file-op");
		expect(edits).toHaveLength(3);
	});

	it("all timelines get user markers even when only one tool is used", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "docs/README.md" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);

		expect(stats.tool_details.read_timeline_events).toHaveLength(2);
		expect(stats.tool_details.edit_timeline_events).toHaveLength(1);
		expect(stats.tool_details.edit_timeline_events[0].kind).toBe("user-marker");
		expect(stats.tool_details.write_timeline_events).toHaveLength(1);
		expect(stats.tool_details.write_timeline_events[0].kind).toBe("user-marker");
	});
});

// ── Write timeline events ───────────────────────────────────

describe("write_timeline_events", () => {
	it("emits user markers and write events in branch order", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[{ name: "Write", arguments: { path: "src/new-file.ts", content: "hello" } }],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Write", false, "2026-03-10T10:00:06Z"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls(
				[{ name: "Write", arguments: { path: "docs/README.md", content: "# hi" } }],
				"2026-03-10T10:01:05Z",
			),
			tool_result_entry("Write", false, "2026-03-10T10:01:06Z"),
		];
		const stats = reconstruct_stats(entries);
		const events = stats.tool_details.write_timeline_events;

		expect(events).toHaveLength(4);
		expect(events[0].kind).toBe("user-marker");
		expect(events[1]).toMatchObject({ kind: "file-op", op_order: 1, path: "src/new-file.ts", category: "code" });
		expect(events[2].kind).toBe("user-marker");
		expect(events[3]).toMatchObject({ kind: "file-op", op_order: 2, path: "docs/README.md", category: "docs" });
	});

	it("marks repeat writes with is_repeat", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[{ name: "Write", arguments: { path: "config.json", content: "{}" } }],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Write"),
			assistant_with_tool_calls(
				[{ name: "Write", arguments: { path: "config.json", content: '{"v":2}' } }],
				"2026-03-10T10:00:10Z",
			),
			tool_result_entry("Write"),
		];
		const stats = reconstruct_stats(entries);
		const writes = stats.tool_details.write_timeline_events.filter((e) => e.kind === "file-op");

		expect(writes[0].is_repeat).toBe(false);
		expect(writes[1].is_repeat).toBe(true);
	});

	it("has independent op_order from read and edit timelines", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Read", arguments: { path: "src/a.ts" } },
					{ name: "Edit", arguments: { path: "src/a.ts", oldText: "x", newText: "y" } },
					{ name: "Write", arguments: { path: "src/b.ts", content: "new" } },
					{ name: "Write", arguments: { path: "src/c.ts", content: "new2" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Read"),
			tool_result_entry("Edit"),
			tool_result_entry("Write"),
			tool_result_entry("Write"),
		];
		const stats = reconstruct_stats(entries);

		const reads = stats.tool_details.read_timeline_events.filter((e) => e.kind === "file-op");
		const edits = stats.tool_details.edit_timeline_events.filter((e) => e.kind === "file-op");
		const writes = stats.tool_details.write_timeline_events.filter((e) => e.kind === "file-op");

		expect(reads[0].op_order).toBe(1);
		expect(edits[0].op_order).toBe(1);
		expect(writes[0].op_order).toBe(1);
		expect(writes[1].op_order).toBe(2);
	});

	it("preserves existing write_files unique list alongside timeline events", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Write", arguments: { path: "a.ts", content: "1" } },
					{ name: "Write", arguments: { path: "b.ts", content: "2" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Write"),
			tool_result_entry("Write"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Write", arguments: { path: "a.ts", content: "3" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Write"),
		];
		const stats = reconstruct_stats(entries);

		expect(stats.tool_details.write_files).toEqual(["a.ts", "b.ts"]);
		expect(stats.tool_details.write_timeline_events).toHaveLength(5);
		const writes = stats.tool_details.write_timeline_events.filter((e) => e.kind === "file-op");
		expect(writes).toHaveLength(3);
	});
});

// ── build_plain_text_summary with timeline data ─────────────

describe("build_plain_text_summary timeline output", () => {
	it("includes user markers and file ops in read timeline", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "docs/README.md" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Read"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/index.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const output = build_plain_text_summary(stats);

		expect(output).toContain("Read timeline (2 reads):");
		expect(output).toContain("● user message #1");
		expect(output).toContain("01 docs/README.md");
		expect(output).toContain("● user message #2");
		expect(output).toContain("02 src/index.ts");
	});

	it("includes edit and write timelines", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(
				[
					{ name: "Edit", arguments: { path: "src/a.ts", oldText: "x", newText: "y" } },
					{ name: "Write", arguments: { path: "src/b.ts", content: "new" } },
				],
				"2026-03-10T10:00:05Z",
			),
			tool_result_entry("Edit"),
			tool_result_entry("Write"),
		];
		const stats = reconstruct_stats(entries);
		const output = build_plain_text_summary(stats);

		expect(output).toContain("Edit timeline (1 edits):");
		expect(output).toContain("01 src/a.ts");
		expect(output).toContain("Write timeline (1 writes):");
		expect(output).toContain("01 src/b.ts");
	});

	it("shows repeat marker in plain text timeline", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/index.ts" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Read"),
			user_entry("2026-03-10T10:01:00Z"),
			assistant_with_tool_calls([{ name: "Read", arguments: { path: "src/index.ts" } }], "2026-03-10T10:01:05Z"),
			tool_result_entry("Read"),
		];
		const stats = reconstruct_stats(entries);
		const output = build_plain_text_summary(stats);

		expect(output).toContain("02 src/index.ts ↺");
	});

	it("truncates timeline at 20 events and shows overflow", () => {
		const tool_calls = [];
		const results = [];
		for (let i = 0; i < 25; i++) {
			tool_calls.push({ name: "Read", arguments: { path: `file-${i}.ts` } });
			results.push(tool_result_entry("Read"));
		}
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls(tool_calls, "2026-03-10T10:00:05Z"),
			...results,
		];
		const stats = reconstruct_stats(entries);
		const output = build_plain_text_summary(stats);

		expect(output).toContain("Read timeline (25 reads):");
		// 1 user marker + 25 file ops = 26 events total, cap at 20 shown
		expect(output).toContain("... (+6 more)");
		// Extract just the timeline section to check truncation
		const timeline_start = output.indexOf("Read timeline");
		const timeline_section = output.slice(timeline_start);
		// file-18 is the 19th file op (user marker + 19 ops = 20 shown items)
		expect(timeline_section).toContain("file-18.ts");
		// file-19 should NOT appear in the timeline (beyond the 20-item cap)
		expect(timeline_section).not.toContain("file-19.ts");
	});

	it("omits timeline section when no file ops exist", () => {
		const entries = [
			user_entry("2026-03-10T10:00:00Z"),
			assistant_with_tool_calls([{ name: "Bash", arguments: { command: "ls" } }], "2026-03-10T10:00:05Z"),
			tool_result_entry("Bash"),
		];
		const stats = reconstruct_stats(entries);
		const output = build_plain_text_summary(stats);

		expect(output).not.toContain("Read timeline");
		expect(output).not.toContain("Edit timeline");
		expect(output).not.toContain("Write timeline");
	});
});
