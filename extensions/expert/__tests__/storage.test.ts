import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	append_reflection_log,
	build_skeleton_yaml,
	delete_expertise,
	get_expertise_dir,
	list_domains,
	read_expertise,
	read_reflection_log,
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
		// Clear any env override
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

	it("parses keywords and aliases", async () => {
		const yaml_content = `domain: test
description: "Test"
last_synced: "2026-01-01"
scope:
  paths: []
keywords:
  - sql
  - query
aliases:
  - db
`;
		await write_expertise(test_dir, "test", yaml_content);
		const result = await read_expertise(test_dir, "test");
		expect(result!.keywords).toEqual(["sql", "query"]);
		expect(result!.aliases).toEqual(["db"]);
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
		expect(settings.auto_inject).toBe(true);
		expect(settings.reflection_model).toBe("");
		expect(settings.max_inject_domains).toBe(5);
	});

	it("parses valid settings", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(
			path.join(test_dir, "settings.json"),
			JSON.stringify({ auto_inject: false, reflection_model: "gpt-4", max_inject_domains: 3 }),
		);
		const settings = await read_settings(test_dir);
		expect(settings.auto_inject).toBe(false);
		expect(settings.reflection_model).toBe("gpt-4");
		expect(settings.max_inject_domains).toBe(3);
	});

	it("fills missing fields with defaults", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), JSON.stringify({ auto_inject: false }));
		const settings = await read_settings(test_dir);
		expect(settings.auto_inject).toBe(false);
		expect(settings.max_inject_domains).toBe(5); // default
	});

	it("returns defaults for invalid JSON", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), "not valid json {{{");
		const settings = await read_settings(test_dir);
		expect(settings.auto_inject).toBe(true);
	});

	it("clamps context percentages to valid range", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(
			path.join(test_dir, "settings.json"),
			JSON.stringify({ max_context_percent_for_auto_inject: 150, max_context_percent_for_any_inject: -5 }),
		);
		const settings = await read_settings(test_dir);
		expect(settings.max_context_percent_for_auto_inject).toBeLessThanOrEqual(100);
		expect(settings.max_context_percent_for_any_inject).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// append_reflection_log / read_reflection_log
// ---------------------------------------------------------------------------

describe("reflection log", () => {
	it("appends entry to new log", async () => {
		const entry = {
			date: "2026-01-01T00:00:00Z",
			domain: "test",
			session: "session-1",
			model: "gpt-4",
			summary: "Added new pattern",
		};
		await append_reflection_log(test_dir, entry);

		const { entries } = await read_reflection_log(test_dir);
		expect(entries.length).toBe(1);
		expect(entries[0].domain).toBe("test");
		expect(entries[0].summary).toBe("Added new pattern");
	});

	it("appends multiple entries", async () => {
		const entry1 = {
			date: "2026-01-01T00:00:00Z",
			domain: "test",
			session: "s1",
			model: "gpt-4",
			summary: "First",
		};
		const entry2 = {
			date: "2026-01-02T00:00:00Z",
			domain: "test",
			session: "s2",
			model: "gpt-4",
			summary: "Second",
		};
		await append_reflection_log(test_dir, entry1);
		await append_reflection_log(test_dir, entry2);

		const { entries } = await read_reflection_log(test_dir);
		expect(entries.length).toBe(2);
		// Sorted by date descending
		expect(entries[0].summary).toBe("Second");
		expect(entries[1].summary).toBe("First");
	});

	it("filters by domain", async () => {
		const entry1 = {
			date: "2026-01-01T00:00:00Z",
			domain: "alpha",
			session: "s1",
			model: "m",
			summary: "A",
		};
		const entry2 = {
			date: "2026-01-02T00:00:00Z",
			domain: "beta",
			session: "s2",
			model: "m",
			summary: "B",
		};
		await append_reflection_log(test_dir, entry1);
		await append_reflection_log(test_dir, entry2);

		const { entries } = await read_reflection_log(test_dir, { domain: "alpha" });
		expect(entries.length).toBe(1);
		expect(entries[0].domain).toBe("alpha");
	});

	it("applies limit", async () => {
		for (let i = 0; i < 5; i++) {
			await append_reflection_log(test_dir, {
				date: `2026-01-0${i + 1}T00:00:00Z`,
				domain: "test",
				session: `s${i}`,
				model: "m",
				summary: `Entry ${i}`,
			});
		}

		const { entries } = await read_reflection_log(test_dir, { limit: 3 });
		expect(entries.length).toBe(3);
	});

	it("returns empty for nonexistent log", async () => {
		const nonexistent = path.join(tmp_dir, "no-log");
		const { entries, skipped_entries } = await read_reflection_log(nonexistent);
		expect(entries).toEqual([]);
		expect(skipped_entries).toBe(0);
	});
});
