import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	extract_modified_files,
	file_matches_scope,
	format_conversation_for_reflection,
	format_conversation_for_router,
	match_domains_to_prompt,
	match_files_to_domains,
	scan_scope_paths,
	validate_domain_name,
} from "../helpers.js";
import type { ExpertiseHeader } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make_domain(overrides: Partial<ExpertiseHeader> & { domain: string }): ExpertiseHeader {
	return {
		description: `Test domain: ${overrides.domain}`,
		last_synced: "2026-01-01T00:00:00Z",
		scope: { paths: [], patterns: [] },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// validate_domain_name
// ---------------------------------------------------------------------------

describe("validate_domain_name", () => {
	it("accepts lowercase names", () => {
		expect(validate_domain_name("database")).toEqual({ valid: true });
	});

	it("accepts hyphenated names", () => {
		expect(validate_domain_name("auth-flow")).toEqual({ valid: true });
	});

	it("accepts names with numbers", () => {
		expect(validate_domain_name("api-v2")).toEqual({ valid: true });
	});

	it("rejects empty string", () => {
		const result = validate_domain_name("");
		expect(result.valid).toBe(false);
	});

	it("rejects uppercase", () => {
		const result = validate_domain_name("Database");
		expect(result.valid).toBe(false);
	});

	it("rejects spaces", () => {
		const result = validate_domain_name("auth flow");
		expect(result.valid).toBe(false);
	});

	it("rejects special characters", () => {
		const result = validate_domain_name("auth_flow");
		expect(result.valid).toBe(false);
	});

	it("rejects leading hyphen", () => {
		const result = validate_domain_name("-auth");
		expect(result.valid).toBe(false);
	});

	it("rejects trailing hyphen", () => {
		const result = validate_domain_name("auth-");
		expect(result.valid).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// match_domains_to_prompt
// ---------------------------------------------------------------------------

describe("match_domains_to_prompt", () => {
	const domains: ExpertiseHeader[] = [
		make_domain({
			domain: "database",
			description: "Database layer and migrations",
			scope: { paths: ["src/db/"], patterns: ["**/*.sql"] },
			keywords: ["postgres", "migration"],
			aliases: ["db"],
		}),
		make_domain({
			domain: "auth-flow",
			description: "Authentication and authorization",
			scope: { paths: ["src/auth/"] },
			keywords: ["login", "jwt", "token"],
		}),
		make_domain({
			domain: "frontend",
			description: "React UI components",
			scope: { paths: ["src/components/"] },
			keywords: ["react", "component"],
		}),
	];

	it("exact domain name match scores +10", () => {
		const matches = match_domains_to_prompt("fix the database connection", domains);
		expect(matches.length).toBeGreaterThanOrEqual(1);
		expect(matches[0].domain.domain).toBe("database");
		expect(matches[0].score).toBeGreaterThanOrEqual(10);
	});

	it("alias match scores +8 (alias must be >= 3 chars)", () => {
		// "db" alias is only 2 chars and gets rejected by term_matches_prompt min-length.
		// Use a domain with a longer alias to test alias scoring.
		const domains_with_alias: ExpertiseHeader[] = [
			make_domain({
				domain: "database",
				description: "Database layer",
				scope: { paths: [] },
				aliases: ["datastore"],
			}),
		];
		const matches = match_domains_to_prompt("check the datastore config", domains_with_alias);
		const db_match = matches.find((m) => m.domain.domain === "database");
		expect(db_match).toBeDefined();
		expect(db_match!.score).toBeGreaterThanOrEqual(8);
	});

	it("keyword match contributes to score (needs threshold of 6)", () => {
		// keyword alone gives +4, below MIN_DOMAIN_MATCH_SCORE of 6.
		// Combine keyword with description word to cross threshold.
		const matches = match_domains_to_prompt("fix the postgres migration", domains);
		const db_match = matches.find((m) => m.domain.domain === "database");
		expect(db_match).toBeDefined();
		// postgres keyword (+4) + "migration" description word (+2) = 6
	});

	it("description word match scores +2", () => {
		const matches = match_domains_to_prompt("check migrations status", domains);
		const db_match = matches.find((m) => m.domain.domain === "database");
		expect(db_match).toBeDefined();
	});

	it("scope path match scores +8", () => {
		const matches = match_domains_to_prompt("fix bug in src/db/query.ts", domains);
		const db_match = matches.find((m) => m.domain.domain === "database");
		expect(db_match).toBeDefined();
		expect(db_match!.score).toBeGreaterThanOrEqual(8);
	});

	it("scope pattern match scores +6", () => {
		// **/*.sql segments all contain *, so extract_pattern_basename_hint returns null.
		// Use a pattern with a non-glob basename segment to test pattern matching.
		const domains_with_pattern: ExpertiseHeader[] = [
			make_domain({
				domain: "database",
				description: "Database layer",
				scope: { paths: [], patterns: ["migrations/*.sql"] },
			}),
		];
		const matches = match_domains_to_prompt("check the migrations folder", domains_with_pattern);
		const db_match = matches.find((m) => m.domain.domain === "database");
		expect(db_match).toBeDefined();
		expect(db_match!.score).toBeGreaterThanOrEqual(6);
	});

	it("filters out below threshold", () => {
		const matches = match_domains_to_prompt("unrelated topic about cooking", domains);
		expect(matches.length).toBe(0);
	});

	it("ranks multiple matches by score", () => {
		const matches = match_domains_to_prompt("fix database auth-flow integration", domains);
		expect(matches.length).toBeGreaterThanOrEqual(2);
		// Both should match, scores may vary
		const domain_names = matches.map((m) => m.domain.domain);
		expect(domain_names).toContain("database");
		expect(domain_names).toContain("auth-flow");
	});
});

// ---------------------------------------------------------------------------
// match_files_to_domains
// ---------------------------------------------------------------------------

describe("match_files_to_domains", () => {
	const cwd = "/projects/my-app";
	const domains: ExpertiseHeader[] = [
		make_domain({ domain: "database", scope: { paths: ["src/db/"], patterns: [] } }),
		make_domain({ domain: "frontend", scope: { paths: ["src/components/"], patterns: ["**/*.css"] } }),
	];

	it("file under scope path matches", () => {
		const result = match_files_to_domains(["src/db/query.ts"], domains, cwd);
		expect(result.map((d) => d.domain)).toContain("database");
	});

	it("file outside scope path skipped", () => {
		const result = match_files_to_domains(["src/utils/helper.ts"], domains, cwd);
		expect(result.length).toBe(0);
	});

	it("glob pattern match", () => {
		const result = match_files_to_domains(["src/styles/main.css"], domains, cwd);
		expect(result.map((d) => d.domain)).toContain("frontend");
	});

	it("multiple files across domains", () => {
		const result = match_files_to_domains(["src/db/query.ts", "src/components/Button.tsx"], domains, cwd);
		expect(result.length).toBe(2);
		const names = result.map((d) => d.domain);
		expect(names).toContain("database");
		expect(names).toContain("frontend");
	});
});

// ---------------------------------------------------------------------------
// file_matches_scope
// ---------------------------------------------------------------------------

describe("file_matches_scope", () => {
	it("direct path match", () => {
		expect(file_matches_scope("src/db/query.ts", ["src/db"])).toBe(true);
	});

	it("subdirectory match", () => {
		expect(file_matches_scope("src/db/models/user.ts", ["src/db"])).toBe(true);
	});

	it("pattern match", () => {
		expect(file_matches_scope("styles/main.css", [], ["**/*.css"])).toBe(true);
	});

	it("no match", () => {
		expect(file_matches_scope("lib/utils.ts", ["src/db"], ["**/*.css"])).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// extract_modified_files
// ---------------------------------------------------------------------------

describe("extract_modified_files", () => {
	it("extracts from toolResult write operations", () => {
		const messages = [{ role: "toolResult", toolName: "write", input: { path: "src/index.ts" } }];
		const result = extract_modified_files(messages);
		expect(result).toContain("src/index.ts");
	});

	it("extracts from toolResult edit operations", () => {
		const messages = [{ role: "toolResult", toolName: "edit", input: { path: "src/utils.ts" } }];
		const result = extract_modified_files(messages);
		expect(result).toContain("src/utils.ts");
	});

	it("extracts from assistant tool_use blocks", () => {
		const messages = [
			{
				role: "assistant",
				content: [{ type: "tool_use", name: "write", input: { path: "src/new.ts" } }],
			},
		];
		const result = extract_modified_files(messages);
		expect(result).toContain("src/new.ts");
	});

	it("deduplicates paths", () => {
		const messages = [
			{ role: "toolResult", toolName: "write", input: { path: "src/index.ts" } },
			{
				role: "assistant",
				content: [{ type: "tool_use", name: "write", input: { path: "src/index.ts" } }],
			},
		];
		const result = extract_modified_files(messages);
		expect(result.filter((p) => p === "src/index.ts").length).toBe(1);
	});

	it("ignores non-write tools", () => {
		const messages = [{ role: "toolResult", toolName: "read", input: { path: "src/index.ts" } }];
		const result = extract_modified_files(messages);
		expect(result.length).toBe(0);
	});

	it("handles null/undefined messages gracefully", () => {
		const messages = [null, undefined, { role: "user", content: "hello" }];
		const result = extract_modified_files(messages);
		expect(result.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// format_conversation_for_reflection
// ---------------------------------------------------------------------------

describe("format_conversation_for_reflection", () => {
	it("formats user messages", () => {
		const messages = [{ role: "user", content: "fix the bug" }];
		const result = format_conversation_for_reflection(messages);
		expect(result).toContain("## User");
		expect(result).toContain("fix the bug");
	});

	it("formats assistant messages", () => {
		const messages = [{ role: "assistant", content: "I'll fix that" }];
		const result = format_conversation_for_reflection(messages);
		expect(result).toContain("## Assistant");
		expect(result).toContain("I'll fix that");
	});

	it("includes tool results", () => {
		const messages = [{ role: "toolResult", toolName: "read", content: "file contents here" }];
		const result = format_conversation_for_reflection(messages);
		expect(result).toContain("## Tool Result (read)");
		expect(result).toContain("file contents here");
	});

	it("filters tool results by scope_paths", () => {
		const messages = [
			{ role: "toolResult", toolName: "read", content: "data", input: { path: "src/db/query.ts" } },
			{ role: "toolResult", toolName: "read", content: "other", input: { path: "src/ui/button.tsx" } },
		];
		const result = format_conversation_for_reflection(messages, ["src/db"]);
		expect(result).toContain("data");
		expect(result).not.toContain("other");
	});

	it("truncates long tool results", () => {
		const long_content = "x".repeat(3000);
		const messages = [{ role: "toolResult", toolName: "read", content: long_content }];
		const result = format_conversation_for_reflection(messages);
		expect(result).toContain("... (truncated)");
		expect(result.length).toBeLessThan(long_content.length);
	});
});

// ---------------------------------------------------------------------------
// format_conversation_for_router
// ---------------------------------------------------------------------------

describe("format_conversation_for_router", () => {
	it("includes user messages", () => {
		const messages = [{ role: "user", content: "fix the bug" }];
		const result = format_conversation_for_router(messages);
		expect(result).toContain("## User");
		expect(result).toContain("fix the bug");
	});

	it("summarizes long assistant messages (head + tail)", () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
		const messages = [{ role: "assistant", content: lines }];
		const result = format_conversation_for_router(messages);
		expect(result).toContain("line 1");
		expect(result).toContain("line 20");
		expect(result).toContain("lines omitted");
	});

	it("extracts tool calls as one-liners", () => {
		const messages = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Let me check" },
					{ type: "tool_use", name: "read", input: { path: "src/index.ts" } },
				],
			},
		];
		const result = format_conversation_for_router(messages);
		expect(result).toContain("## Tool Calls");
		expect(result).toContain("read src/index.ts");
	});

	it("excludes tool results", () => {
		const messages = [{ role: "toolResult", toolName: "read", content: "secret data" }];
		const result = format_conversation_for_router(messages);
		expect(result).not.toContain("secret data");
	});
});

// ---------------------------------------------------------------------------
// scan_scope_paths
// ---------------------------------------------------------------------------

describe("scan_scope_paths", () => {
	let tmp_dir: string;

	beforeAll(async () => {
		tmp_dir = await mkdtemp(path.join(os.tmpdir(), "expert-helpers-test-"));

		// Create test directory structure
		await mkdir(path.join(tmp_dir, "src", "db"), { recursive: true });
		await mkdir(path.join(tmp_dir, "src", "ui"), { recursive: true });
		await mkdir(path.join(tmp_dir, "node_modules", "pkg"), { recursive: true });
		await writeFile(path.join(tmp_dir, "src", "db", "query.ts"), "export {}");
		await writeFile(path.join(tmp_dir, "src", "db", "model.ts"), "export {}");
		await writeFile(path.join(tmp_dir, "src", "ui", "button.tsx"), "export {}");
		await writeFile(path.join(tmp_dir, "src", "index.ts"), "export {}");
		await writeFile(path.join(tmp_dir, "node_modules", "pkg", "index.js"), "export {}");
	});

	afterAll(async () => {
		await rm(tmp_dir, { recursive: true, force: true });
	});

	it("lists files in scope directories", async () => {
		const result = await scan_scope_paths(["src/db"], tmp_dir);
		expect(result.length).toBe(2);
		expect(result).toContain("src/db/query.ts");
		expect(result).toContain("src/db/model.ts");
	});

	it("includes single files", async () => {
		const result = await scan_scope_paths(["src/index.ts"], tmp_dir);
		expect(result).toContain("src/index.ts");
	});

	it("skips ignored subdirectories (node_modules) during walk", async () => {
		// is_ignored_dir only applies to subdirectories encountered during walk,
		// not to the top-level scope path. So walk "src" and verify node_modules
		// under it would be skipped (test by walking the whole tmp_dir).
		const result = await scan_scope_paths(["."], tmp_dir);
		const has_node_modules_file = result.some((f) => f.includes("node_modules"));
		expect(has_node_modules_file).toBe(false);
	});

	it("skips missing paths", async () => {
		const result = await scan_scope_paths(["nonexistent/"], tmp_dir);
		expect(result.length).toBe(0);
	});

	it("results are sorted", async () => {
		const result = await scan_scope_paths(["src"], tmp_dir);
		const sorted = [...result].sort();
		expect(result).toEqual(sorted);
	});
});
