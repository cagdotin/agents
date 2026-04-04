import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse_init_args, scan_scope_paths, tokenize_command_args, validate_domain_name } from "../helpers.js";

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

// ---------------------------------------------------------------------------
// tokenize_command_args
// ---------------------------------------------------------------------------

describe("tokenize_command_args", () => {
	it("splits simple tokens", () => {
		expect(tokenize_command_args("init my-domain src/")).toEqual(["init", "my-domain", "src/"]);
	});

	it("handles double-quoted strings", () => {
		expect(tokenize_command_args('init db src/ --description "My database layer"')).toEqual([
			"init",
			"db",
			"src/",
			"--description",
			"My database layer",
		]);
	});

	it("handles single-quoted strings", () => {
		expect(tokenize_command_args("init db src/ --description 'My database layer'")).toEqual([
			"init",
			"db",
			"src/",
			"--description",
			"My database layer",
		]);
	});

	it("handles empty quoted strings", () => {
		expect(tokenize_command_args('init db "" src/')).toEqual(["init", "db", "", "src/"]);
	});

	it("handles empty input", () => {
		expect(tokenize_command_args("")).toEqual([]);
	});

	it("handles extra whitespace", () => {
		expect(tokenize_command_args("  init   db   src/  ")).toEqual(["init", "db", "src/"]);
	});
});

// ---------------------------------------------------------------------------
// parse_init_args
// ---------------------------------------------------------------------------

describe("parse_init_args", () => {
	it("parses minimal args (domain + scope_path)", () => {
		const result = parse_init_args("init my-domain src/");
		expect(result.error).toBeUndefined();
		expect(result.domain).toBe("my-domain");
		expect(result.scope_path).toBe("src/");
		expect(result.description).toBeUndefined();
	});

	it("parses with --description", () => {
		const result = parse_init_args('init db src/db --description "Database layer"');
		expect(result.error).toBeUndefined();
		expect(result.domain).toBe("db");
		expect(result.scope_path).toBe("src/db");
		expect(result.description).toBe("Database layer");
	});

	it("parses with single-quoted description", () => {
		const result = parse_init_args("init db src/db --description 'Database layer'");
		expect(result.error).toBeUndefined();
		expect(result.description).toBe("Database layer");
	});

	it("returns error when no args after init", () => {
		const result = parse_init_args("init");
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Usage");
	});

	it("returns error when only domain (no scope_path)", () => {
		const result = parse_init_args("init my-domain");
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Usage");
	});

	it("returns error when input is not init", () => {
		const result = parse_init_args("list");
		expect(result.error).toBeDefined();
	});

	it("returns error for missing --description value", () => {
		const result = parse_init_args("init db src/ --description");
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Missing value");
	});

	it("returns error for unknown option", () => {
		const result = parse_init_args("init db src/ --verbose");
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Unknown option");
		expect(result.error).toContain("--verbose");
	});

	it("returns error for unexpected positional args", () => {
		const result = parse_init_args("init db src/ extra-arg");
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Unexpected");
	});

	it("returns error for empty quoted description", () => {
		const result = parse_init_args('init db src/ --description ""');
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Missing value");
	});
});
