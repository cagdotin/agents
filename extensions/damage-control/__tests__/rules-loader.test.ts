import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { load_rules } from "../rules-loader.js";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let tmp_dir: string;
let test_dir: string;
let test_counter = 0;

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "dc-rules-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(async () => {
	test_counter += 1;
	test_dir = path.join(tmp_dir, `sub-${test_counter}`);
	await mkdir(test_dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper to create a bundled rules file for testing
// ---------------------------------------------------------------------------

async function create_bundled_rules(dir: string, content: string): Promise<string> {
	const rules_path = path.join(dir, "damage-control-rules.yaml");
	await writeFile(rules_path, content);
	// Return a fake import.meta.url that resolves to this directory
	return `file://${dir}/index.ts`;
}

async function create_project_rules(cwd: string, content: string): Promise<void> {
	const pi_dir = path.join(cwd, ".pi");
	await mkdir(pi_dir, { recursive: true });
	await writeFile(path.join(pi_dir, "damage-control-rules.yaml"), content);
}

// ---------------------------------------------------------------------------
// load_rules — basic loading
// ---------------------------------------------------------------------------

describe("load_rules — basic", () => {
	it("loads bundled rules", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
zero_access_paths:
  - ~/.ssh/
  - ~/.gnupg/
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.zero_access_paths.length).toBeGreaterThanOrEqual(2);
		const patterns = result.rules.zero_access_paths.map((r) => r.pattern);
		expect(patterns).toContain("~/.ssh/");
		expect(patterns).toContain("~/.gnupg/");
	});

	it("skips missing global/project files gracefully", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
zero_access_paths:
  - /etc/shadow
`,
		);

		const result = await load_rules(test_dir, import_url);
		// Should have loaded bundled, skipped global and project
		expect(result.stats.loaded_sources.length).toBeGreaterThanOrEqual(1);
		expect(result.stats.loaded_sources[0].kind).toBe("bundled");
	});

	it("merges bundled and project rules", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
zero_access_paths:
  - /etc/shadow
`,
		);
		await create_project_rules(
			test_dir,
			`version: 1
read_only_paths:
  - node_modules/
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.zero_access_paths.some((r) => r.pattern === "/etc/shadow")).toBe(true);
		expect(result.rules.read_only_paths.some((r) => r.pattern === "node_modules/")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Rule parsing
// ---------------------------------------------------------------------------

describe("load_rules — rule parsing", () => {
	it("warns on unknown keys", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
custom_key: value
zero_access_paths: []
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.warnings.some((w) => w.includes("custom_key"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Bash pattern normalization
// ---------------------------------------------------------------------------

describe("load_rules — bash patterns", () => {
	it("compiles valid bash patterns", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
bash_tool_patterns:
  - pattern: "curl.*\\\\|.*sh"
    reason: "pipe to shell is dangerous"
    action: block
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.bash_tool_patterns.length).toBe(1);
		expect(result.rules.bash_tool_patterns[0].action).toBe("block");
		expect(result.rules.bash_tool_patterns[0].reason).toBe("pipe to shell is dangerous");
	});

	it("rejects patterns with missing pattern field", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
bash_tool_patterns:
  - reason: "no pattern"
    action: block
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.bash_tool_patterns.length).toBe(0);
		expect(result.stats.invalid_rule_count).toBeGreaterThan(0);
	});

	it("rejects patterns with missing reason field", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
bash_tool_patterns:
  - pattern: "rm -rf"
    action: block
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.bash_tool_patterns.length).toBe(0);
		expect(result.stats.invalid_rule_count).toBeGreaterThan(0);
	});

	it("supports ask action", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
bash_tool_patterns:
  - pattern: "docker rm"
    reason: "removing containers"
    action: ask
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.bash_tool_patterns[0].action).toBe("ask");
	});

	it("defaults to block action", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
bash_tool_patterns:
  - pattern: "dangerous"
    reason: "it's dangerous"
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.bash_tool_patterns[0].action).toBe("block");
	});
});

// ---------------------------------------------------------------------------
// Path rule normalization
// ---------------------------------------------------------------------------

describe("load_rules — path rules", () => {
	it("normalizes string array", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
read_only_paths:
  - config/
  - .env
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.read_only_paths.length).toBe(2);
	});

	it("rejects non-string values", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
read_only_paths:
  - valid-path
  - 123
  - true
`,
		);

		const result = await load_rules(test_dir, import_url);
		expect(result.rules.read_only_paths.length).toBe(1);
		expect(result.stats.invalid_rule_count).toBeGreaterThan(0);
	});

	it("rejects empty strings", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
zero_access_paths:
  - ""
  - "   "
  - valid-path
`,
		);

		const result = await load_rules(test_dir, import_url);
		// Only "valid-path" should survive. Empty and whitespace-only are rejected.
		expect(result.rules.zero_access_paths.length).toBe(1);
		expect(result.rules.zero_access_paths[0].pattern).toBe("valid-path");
	});
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("load_rules — deduplication", () => {
	it("deduplicates path rules across sources", async () => {
		const import_url = await create_bundled_rules(
			test_dir,
			`version: 1
zero_access_paths:
  - /etc/shadow
`,
		);
		await create_project_rules(
			test_dir,
			`version: 1
zero_access_paths:
  - /etc/shadow
`,
		);

		const result = await load_rules(test_dir, import_url);
		const shadow_rules = result.rules.zero_access_paths.filter((r) => r.pattern === "/etc/shadow");
		expect(shadow_rules.length).toBe(1);
	});
});
