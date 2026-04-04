import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import {
	append_to_section,
	build_skeleton_yaml,
	delete_expertise,
	get_expertise_dir,
	list_domains,
	read_expertise,
	read_settings,
	write_expertise,
} from "../storage.js";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let tmp_dir: string;
let test_dir: string;
let test_counter = 0;

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "expert-storage-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(() => {
	test_counter += 1;
	test_dir = path.join(tmp_dir, `sub-${test_counter}`);
});

// ---------------------------------------------------------------------------
// get_expertise_dir
// ---------------------------------------------------------------------------

describe("get_expertise_dir", () => {
	it("returns default .pi/expertise path", () => {
		const cwd = "/projects/app";
		const original = process.env.PI_EXPERTISE_PATH;
		delete process.env.PI_EXPERTISE_PATH;
		const result = get_expertise_dir(cwd);
		expect(result).toBe(path.resolve(cwd, ".pi/expertise"));
		if (original !== undefined) process.env.PI_EXPERTISE_PATH = original;
	});

	it("respects env override", () => {
		const cwd = "/projects/app";
		const original = process.env.PI_EXPERTISE_PATH;
		process.env.PI_EXPERTISE_PATH = "/custom/expertise";
		const result = get_expertise_dir(cwd);
		expect(result).toBe("/custom/expertise");
		if (original !== undefined) {
			process.env.PI_EXPERTISE_PATH = original;
		} else {
			delete process.env.PI_EXPERTISE_PATH;
		}
	});
});

// ---------------------------------------------------------------------------
// read_expertise / write_expertise
// ---------------------------------------------------------------------------

describe("read_expertise / write_expertise", () => {
	it("round-trips write → read", async () => {
		const yaml_content = `domain: test-domain
description: "A test domain"
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths:
    - src/test/
`;
		await write_expertise(test_dir, "test-domain", yaml_content);
		const result = await read_expertise(test_dir, "test-domain");
		expect(result).not.toBeNull();
		expect(result!.domain).toBe("test-domain");
		expect(result!.description).toBe("A test domain");
		expect(result!.scope.paths).toEqual(["src/test/"]);
		expect(result!.raw).toBe(yaml_content);
	});

	it("returns null for missing domain", async () => {
		await mkdir(test_dir, { recursive: true });
		const result = await read_expertise(test_dir, "nonexistent");
		expect(result).toBeNull();
	});

	it("parses related_domains", async () => {
		const yaml_content = `domain: test
description: "Test"
last_synced: "2026-01-01"
scope:
  paths: []
related_domains:
  - auth-flow
  - frontend
`;
		await write_expertise(test_dir, "test", yaml_content);
		const result = await read_expertise(test_dir, "test");
		expect(result!.related_domains).toEqual(["auth-flow", "frontend"]);
	});
});

// ---------------------------------------------------------------------------
// delete_expertise
// ---------------------------------------------------------------------------

describe("delete_expertise", () => {
	it("deletes existing domain", async () => {
		await write_expertise(test_dir, "to-delete", "domain: to-delete\n");
		const deleted = await delete_expertise(test_dir, "to-delete");
		expect(deleted).toBe(true);
		const result = await read_expertise(test_dir, "to-delete");
		expect(result).toBeNull();
	});

	it("returns false for nonexistent domain", async () => {
		await mkdir(test_dir, { recursive: true });
		const deleted = await delete_expertise(test_dir, "nonexistent");
		expect(deleted).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// list_domains
// ---------------------------------------------------------------------------

describe("list_domains", () => {
	it("lists multiple domains sorted", async () => {
		await write_expertise(test_dir, "zeta", "domain: zeta\ndescription: Z\nscope:\n  paths: []\n");
		await write_expertise(test_dir, "alpha", "domain: alpha\ndescription: A\nscope:\n  paths: []\n");
		await write_expertise(test_dir, "mid", "domain: mid\ndescription: M\nscope:\n  paths: []\n");

		const result = await list_domains(test_dir);
		expect(result.length).toBe(3);
		expect(result[0].domain).toBe("alpha");
		expect(result[1].domain).toBe("mid");
		expect(result[2].domain).toBe("zeta");
	});

	it("returns empty array for nonexistent directory", async () => {
		const result = await list_domains(path.join(tmp_dir, "nonexistent"));
		expect(result).toEqual([]);
	});

	it("ignores non-YAML files", async () => {
		await write_expertise(test_dir, "valid", "domain: valid\nscope:\n  paths: []\n");
		await writeFile(path.join(test_dir, "readme.md"), "# Notes");
		await writeFile(path.join(test_dir, "settings.json"), "{}");

		const result = await list_domains(test_dir);
		expect(result.length).toBe(1);
		expect(result[0].domain).toBe("valid");
	});
});

// ---------------------------------------------------------------------------
// build_skeleton_yaml
// ---------------------------------------------------------------------------

describe("build_skeleton_yaml", () => {
	it("produces valid YAML with domain info", () => {
		const yaml = build_skeleton_yaml("my-domain", "My domain description", ["src/", "lib/"]);
		expect(yaml).toContain("domain: my-domain");
		expect(yaml).toContain("description: My domain description");
		expect(yaml).toContain("src/");
		expect(yaml).toContain("lib/");
	});
});

// ---------------------------------------------------------------------------
// read_settings
// ---------------------------------------------------------------------------

describe("read_settings", () => {
	it("returns defaults when file is missing", async () => {
		await mkdir(test_dir, { recursive: true });
		const settings = await read_settings(test_dir);
		expect(settings.max_context_percent_for_any_inject).toBe(92);
	});

	it("parses valid settings", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), JSON.stringify({ max_context_percent_for_any_inject: 85 }));
		const settings = await read_settings(test_dir);
		expect(settings.max_context_percent_for_any_inject).toBe(85);
	});

	it("returns defaults for invalid JSON", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), "not valid json {{{");
		const settings = await read_settings(test_dir);
		expect(settings.max_context_percent_for_any_inject).toBe(92);
	});

	it("keeps valid settings while ignoring invalid field types", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(
			path.join(test_dir, "settings.json"),
			JSON.stringify({ max_context_percent_for_any_inject: "invalid" }),
		);
		const settings = await read_settings(test_dir);
		expect(settings.max_context_percent_for_any_inject).toBe(92); // default, because "invalid" is not a number
	});

	it("clamps context percentages to valid range", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), JSON.stringify({ max_context_percent_for_any_inject: -5 }));
		const settings = await read_settings(test_dir);
		expect(settings.max_context_percent_for_any_inject).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// append_to_section
// ---------------------------------------------------------------------------

describe("append_to_section", () => {
	it("appends to an existing list section", async () => {
		const yaml_content = `domain: test
description: Test domain
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths: []
gotchas:
  - Existing gotcha
`;
		await write_expertise(test_dir, "test", yaml_content);

		const result = await append_to_section(test_dir, "test", "gotchas", "New gotcha discovered");
		expect(result.error).toBeUndefined();

		const updated = await read_expertise(test_dir, "test");
		expect(updated).not.toBeNull();
		const parsed = YAML.parse(updated!.raw);
		expect(parsed.gotchas).toEqual(["Existing gotcha", "New gotcha discovered"]);
		// last_synced should be updated
		expect(parsed.last_synced).not.toBe("2026-01-01T00:00:00Z");
	});

	it("creates a new section when it doesn't exist", async () => {
		const yaml_content = `domain: test
description: Test domain
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths: []
`;
		await write_expertise(test_dir, "test", yaml_content);

		const result = await append_to_section(test_dir, "test", "patterns", "New pattern");
		expect(result.error).toBeUndefined();

		const updated = await read_expertise(test_dir, "test");
		const parsed = YAML.parse(updated!.raw);
		expect(parsed.patterns).toEqual(["New pattern"]);
	});

	it("creates a new section when existing section is empty string", async () => {
		const yaml_content = `domain: test
description: Test domain
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths: []
patterns: ""
`;
		await write_expertise(test_dir, "test", yaml_content);

		const result = await append_to_section(test_dir, "test", "patterns", "A pattern");
		expect(result.error).toBeUndefined();

		const updated = await read_expertise(test_dir, "test");
		const parsed = YAML.parse(updated!.raw);
		expect(parsed.patterns).toEqual(["A pattern"]);
	});

	it("returns error for non-existent domain", async () => {
		await mkdir(test_dir, { recursive: true });
		const result = await append_to_section(test_dir, "nonexistent", "gotchas", "test");
		expect(result.error).toContain("not found");
	});

	it("returns error for non-list section", async () => {
		const yaml_content = `domain: test
description: Test domain
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths: []
overview: "This is a string section"
`;
		await write_expertise(test_dir, "test", yaml_content);

		const result = await append_to_section(test_dir, "test", "overview", "should fail");
		expect(result.error).toContain("not a list");
	});

	it("handles empty list section", async () => {
		const yaml_content = `domain: test
description: Test domain
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths: []
gotchas: []
`;
		await write_expertise(test_dir, "test", yaml_content);

		const result = await append_to_section(test_dir, "test", "gotchas", "First gotcha");
		expect(result.error).toBeUndefined();

		const updated = await read_expertise(test_dir, "test");
		const parsed = YAML.parse(updated!.raw);
		expect(parsed.gotchas).toEqual(["First gotcha"]);
	});
});
