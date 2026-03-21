import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	command_mentions_path_rule,
	expand_home,
	is_bash_delete_operation,
	is_bash_mutation_operation,
	normalize_path,
	path_rule_matches_target,
	truncate_preview,
} from "../matcher.js";
import type { PathRule } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make_rule(pattern: string): PathRule {
	return { pattern, source: { kind: "bundled", path: "test" }, signature: `test:${pattern}` };
}

const CWD = "/projects/my-app";

// ---------------------------------------------------------------------------
// normalize_path
// ---------------------------------------------------------------------------

describe("normalize_path", () => {
	it("converts backslashes to forward slashes", () => {
		expect(normalize_path("foo\\bar\\baz")).toBe("foo/bar/baz");
	});

	it("keeps forward slashes unchanged", () => {
		expect(normalize_path("foo/bar/baz")).toBe("foo/bar/baz");
	});

	it("handles mixed slashes", () => {
		expect(normalize_path("foo\\bar/baz\\qux")).toBe("foo/bar/baz/qux");
	});

	it("handles empty string", () => {
		expect(normalize_path("")).toBe("");
	});
});

// ---------------------------------------------------------------------------
// expand_home
// ---------------------------------------------------------------------------

describe("expand_home", () => {
	it("expands bare ~ to home directory", () => {
		expect(expand_home("~")).toBe(os.homedir());
	});

	it("expands ~/path to home-rooted path", () => {
		const result = expand_home("~/Documents/file.txt");
		expect(result).toBe(path.join(os.homedir(), "Documents/file.txt"));
	});

	it("passes through absolute paths", () => {
		expect(expand_home("/usr/local/bin")).toBe("/usr/local/bin");
	});

	it("passes through relative paths", () => {
		expect(expand_home("relative/path")).toBe("relative/path");
	});
});

// ---------------------------------------------------------------------------
// path_rule_matches_target — exact paths
// ---------------------------------------------------------------------------

describe("path_rule_matches_target — exact paths", () => {
	it("matches absolute path exactly", () => {
		expect(
			path_rule_matches_target("/projects/my-app/src/index.ts", make_rule("/projects/my-app/src/index.ts"), CWD),
		).toBe(true);
	});

	it("matches relative path", () => {
		expect(path_rule_matches_target("src/index.ts", make_rule("src/index.ts"), CWD)).toBe(true);
	});

	it("matches basename-only rule", () => {
		expect(path_rule_matches_target("src/package.json", make_rule("package.json"), CWD)).toBe(true);
	});

	it("does not match different file", () => {
		expect(path_rule_matches_target("src/other.ts", make_rule("src/index.ts"), CWD)).toBe(false);
	});

	it("does not match empty pattern", () => {
		expect(path_rule_matches_target("src/index.ts", make_rule(""), CWD)).toBe(false);
	});

	it("does not match whitespace-only pattern", () => {
		expect(path_rule_matches_target("src/index.ts", make_rule("   "), CWD)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// path_rule_matches_target — directory rules
// ---------------------------------------------------------------------------

describe("path_rule_matches_target — directory rules", () => {
	it("trailing slash matches children", () => {
		expect(path_rule_matches_target("src/lib/util.ts", make_rule("src/"), CWD)).toBe(true);
	});

	it("trailing slash matches nested children", () => {
		expect(path_rule_matches_target("src/deep/nested/file.ts", make_rule("src/"), CWD)).toBe(true);
	});

	it("trailing slash matches exact directory", () => {
		expect(path_rule_matches_target("src", make_rule("src/"), CWD)).toBe(true);
	});

	it("trailing slash does not match sibling", () => {
		expect(path_rule_matches_target("lib/util.ts", make_rule("src/"), CWD)).toBe(false);
	});

	it("trailing slash does not match prefix overlap", () => {
		expect(path_rule_matches_target("src-other/file.ts", make_rule("src/"), CWD)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// path_rule_matches_target — glob rules
// ---------------------------------------------------------------------------

describe("path_rule_matches_target — glob rules", () => {
	it("* matches single segment", () => {
		expect(path_rule_matches_target("src/index.ts", make_rule("src/*.ts"), CWD)).toBe(true);
	});

	it("* does not match multiple segments", () => {
		expect(path_rule_matches_target("src/nested/index.ts", make_rule("src/*.ts"), CWD)).toBe(false);
	});

	it("** matches multiple segments", () => {
		expect(path_rule_matches_target("src/deep/nested/index.ts", make_rule("src/**/*.ts"), CWD)).toBe(true);
	});

	it("? matches single character", () => {
		expect(path_rule_matches_target("src/a.ts", make_rule("src/?.ts"), CWD)).toBe(true);
	});

	it("? does not match multiple characters", () => {
		expect(path_rule_matches_target("src/ab.ts", make_rule("src/?.ts"), CWD)).toBe(false);
	});

	it("basename-only glob matches", () => {
		expect(path_rule_matches_target("src/test.log", make_rule("*.log"), CWD)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// command_mentions_path_rule
// ---------------------------------------------------------------------------

describe("command_mentions_path_rule", () => {
	it("detects path substring in command", () => {
		expect(command_mentions_path_rule("rm -rf src/config", make_rule("src/config"), CWD)).toBe(true);
	});

	it("detects basename match", () => {
		expect(command_mentions_path_rule("cat package.json", make_rule("package.json"), CWD)).toBe(true);
	});

	it("detects absolute path in command", () => {
		const rule = make_rule("src/config");
		expect(command_mentions_path_rule(`cat ${path.resolve(CWD, "src/config")}`, rule, CWD)).toBe(true);
	});

	it("skips probes shorter than 3 chars", () => {
		// Single-char basename "a" won't match even if present in command
		expect(command_mentions_path_rule("cat a file", make_rule("/some/long/path/a"), CWD)).toBe(false);
	});

	it("returns false when no mention", () => {
		expect(command_mentions_path_rule("echo hello", make_rule("src/secret.key"), CWD)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is_bash_delete_operation
// ---------------------------------------------------------------------------

describe("is_bash_delete_operation", () => {
	const delete_commands = [
		"rm -rf /tmp/stuff",
		"rmdir old-folder",
		"mv file.txt /dev/null",
		"git clean -fd",
		"git rm cached.file",
		"aws s3 rm s3://bucket/key",
		"aws s3 rb s3://bucket",
		"drop table users",
		"drop database test",
		"truncate table logs",
	];

	for (const cmd of delete_commands) {
		it(`detects: ${cmd}`, () => {
			expect(is_bash_delete_operation(cmd)).toBe(true);
		});
	}

	it("does not flag safe commands", () => {
		expect(is_bash_delete_operation("echo hello")).toBe(false);
		expect(is_bash_delete_operation("cat file.txt")).toBe(false);
		expect(is_bash_delete_operation("ls -la")).toBe(false);
		expect(is_bash_delete_operation("grep -r pattern .")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// is_bash_mutation_operation
// ---------------------------------------------------------------------------

describe("is_bash_mutation_operation", () => {
	it("detects sed -i", () => {
		expect(is_bash_mutation_operation("sed -i 's/foo/bar/g' file.txt")).toBe(true);
	});

	it("detects tee with redirect", () => {
		expect(is_bash_mutation_operation("echo data | tee output.txt > /dev/null")).toBe(true);
	});

	it("detects install -g", () => {
		expect(is_bash_mutation_operation("npm install -g pkg")).toBe(true);
	});

	it("detects redirect >", () => {
		expect(is_bash_mutation_operation("echo data > file.txt")).toBe(true);
	});

	it("detects append >>", () => {
		expect(is_bash_mutation_operation("echo data >> file.txt")).toBe(true);
	});

	it("includes delete operations", () => {
		expect(is_bash_mutation_operation("rm -rf /tmp/stuff")).toBe(true);
	});

	it("does not flag read-only commands", () => {
		expect(is_bash_mutation_operation("cat file.txt")).toBe(false);
		expect(is_bash_mutation_operation("grep -r pattern .")).toBe(false);
	});

	// ── safe redirect patterns (should NOT be flagged) ───────

	it("does not flag 2>/dev/null (stderr to null)", () => {
		expect(is_bash_mutation_operation("grep -r pattern dir/ 2>/dev/null")).toBe(false);
	});

	it("does not flag >/dev/null (stdout to null)", () => {
		expect(is_bash_mutation_operation("command >/dev/null")).toBe(false);
	});

	it("does not flag 2>&1 (stderr to stdout)", () => {
		expect(is_bash_mutation_operation("grep -r pattern dir/ 2>&1")).toBe(false);
	});

	it("does not flag &>/dev/null (both to null)", () => {
		expect(is_bash_mutation_operation("command &>/dev/null")).toBe(false);
	});

	it("does not flag combined safe redirects", () => {
		expect(is_bash_mutation_operation("grep -r 'text' src/ 2>/dev/null | head -5")).toBe(false);
	});

	it("does not flag grep with path containing dist/ and 2>/dev/null", () => {
		expect(
			is_bash_mutation_operation("grep -r 'wrapText' node_modules/@mariozechner/pi-tui/dist/ 2>/dev/null | head -5"),
		).toBe(false);
	});

	// ── dangerous redirect patterns (SHOULD be flagged) ─────

	it("still flags real file redirect with 2>/dev/null present", () => {
		expect(is_bash_mutation_operation("cmd > output.txt 2>/dev/null")).toBe(true);
	});

	it("still flags >> append to real file", () => {
		expect(is_bash_mutation_operation("echo data >> log.txt 2>&1")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// truncate_preview
// ---------------------------------------------------------------------------

describe("truncate_preview", () => {
	it("returns short text unchanged", () => {
		expect(truncate_preview("short text")).toBe("short text");
	});

	it("returns text at limit unchanged", () => {
		const text = "a".repeat(200);
		expect(truncate_preview(text)).toBe(text);
	});

	it("truncates text over limit with ellipsis", () => {
		const text = "a".repeat(250);
		const result = truncate_preview(text);
		expect(result.length).toBe(200);
		expect(result.endsWith("…")).toBe(true);
	});

	it("collapses multi-line to single line", () => {
		const text = "line1\n  line2\n  line3";
		expect(truncate_preview(text)).toBe("line1 line2 line3");
	});

	it("respects custom max_length", () => {
		const text = "a".repeat(50);
		const result = truncate_preview(text, 20);
		expect(result.length).toBe(20);
		expect(result.endsWith("…")).toBe(true);
	});
});
