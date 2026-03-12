import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { write_expertise } from "../storage.js";
import { create_expertise_tool } from "../tool.js";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let tmp_dir: string;
let test_dir: string;
let test_counter = 0;

const tool = create_expertise_tool(".pi/expertise");

function make_ctx(expertise_dir: string) {
	// get_expertise_dir(cwd) resolves to cwd + "/.pi/expertise"
	// So cwd must be two levels above the expertise dir
	return { cwd: path.resolve(expertise_dir, "..", "..") };
}

async function execute(params: Record<string, unknown>, dir: string) {
	const ctx = make_ctx(dir);
	return tool.execute("test-call", params, undefined, () => {}, ctx);
}

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "expert-tool-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(async () => {
	test_counter += 1;
	// Create a .pi/expertise subdirectory so get_expertise_dir resolves correctly
	test_dir = path.join(tmp_dir, `sub-${test_counter}`, ".pi", "expertise");
	await mkdir(test_dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper to write a domain YAML directly
// ---------------------------------------------------------------------------

const SAMPLE_YAML = `domain: test-domain
description: "A test domain"
last_synced: "2026-01-01T00:00:00Z"
scope:
  paths:
    - src/test/
gotchas:
  - "Watch out for X"
`;

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe("list action", () => {
	it("returns empty when no domains exist", async () => {
		const result = await execute({ action: "list" }, test_dir);
		expect(result.content[0].text).toContain("No expertise domains");
		expect(result.details.action).toBe("list");
		expect(result.details.domains).toEqual([]);
	});

	it("lists existing domains", async () => {
		await write_expertise(test_dir, "alpha", 'domain: alpha\ndescription: "First"\nscope:\n  paths: []\n');
		await write_expertise(test_dir, "beta", 'domain: beta\ndescription: "Second"\nscope:\n  paths: []\n');

		const result = await execute({ action: "list" }, test_dir);
		expect(result.details.domains).toHaveLength(2);
		expect(result.content[0].text).toContain("alpha");
		expect(result.content[0].text).toContain("beta");
	});
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe("get action", () => {
	it("returns error when domain param is missing", async () => {
		const result = await execute({ action: "get" }, test_dir);
		expect(result.details.error).toContain("domain is required");
	});

	it("returns error for non-existent domain", async () => {
		const result = await execute({ action: "get", domain: "nonexistent" }, test_dir);
		expect(result.details.error).toContain("not found");
	});

	it("returns full YAML for existing domain", async () => {
		await write_expertise(test_dir, "test-domain", SAMPLE_YAML);

		const result = await execute({ action: "get", domain: "test-domain" }, test_dir);
		expect(result.details.error).toBeUndefined();
		expect(result.details.domain).toBe("test-domain");
		expect(result.content[0].text).toContain("Watch out for X");
	});
});

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

describe("init action", () => {
	it("returns error when domain param is missing", async () => {
		const result = await execute({ action: "init" }, test_dir);
		expect(result.details.error).toContain("domain is required");
	});

	it("returns error when description is missing", async () => {
		const result = await execute({ action: "init", domain: "new-domain", scope_paths: ["src/"] }, test_dir);
		expect(result.details.error).toContain("description is required");
	});

	it("returns error when scope_paths is missing", async () => {
		const result = await execute({ action: "init", domain: "new-domain", description: "A domain" }, test_dir);
		expect(result.details.error).toContain("scope_paths is required");
	});

	it("returns error for invalid domain name", async () => {
		const result = await execute(
			{ action: "init", domain: "Bad_Name", description: "A domain", scope_paths: ["src/"] },
			test_dir,
		);
		expect(result.details.error).toContain("lowercase");
	});

	it("returns error when domain already exists", async () => {
		await write_expertise(test_dir, "existing", "domain: existing\nscope:\n  paths: []\n");

		const result = await execute(
			{ action: "init", domain: "existing", description: "Dup", scope_paths: ["src/"] },
			test_dir,
		);
		expect(result.details.error).toContain("already exists");
	});

	it("creates a new domain successfully", async () => {
		const result = await execute(
			{ action: "init", domain: "fresh", description: "A fresh domain", scope_paths: ["src/"] },
			test_dir,
		);
		expect(result.details.error).toBeUndefined();
		expect(result.details.action).toBe("init");
		expect(result.details.domain).toBe("fresh");
		expect(result.content[0].text).toContain("initialized");
	});
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("update action", () => {
	it("returns error when domain param is missing", async () => {
		const result = await execute({ action: "update" }, test_dir);
		expect(result.details.error).toContain("domain is required");
	});

	it("returns error when content param is missing", async () => {
		const result = await execute({ action: "update", domain: "test" }, test_dir);
		expect(result.details.error).toContain("content");
	});

	it("returns error for non-existent domain", async () => {
		const result = await execute({ action: "update", domain: "ghost", content: "domain: ghost\n" }, test_dir);
		expect(result.details.error).toContain("not found");
	});

	it("updates existing domain", async () => {
		await write_expertise(test_dir, "updatable", "domain: updatable\nscope:\n  paths: []\n");

		const new_content = 'domain: updatable\ndescription: "Updated"\nscope:\n  paths: []\n';
		const result = await execute({ action: "update", domain: "updatable", content: new_content }, test_dir);
		expect(result.details.error).toBeUndefined();
		expect(result.content[0].text).toContain("updated");
	});

	it("warns when content exceeds 80 lines", async () => {
		await write_expertise(test_dir, "big", "domain: big\nscope:\n  paths: []\n");

		const long_content = `domain: big\nscope:\n  paths: []\ngotchas:\n${Array(90).fill("  - gotcha\n").join("")}`;
		const result = await execute({ action: "update", domain: "big", content: long_content }, test_dir);
		expect(result.details.error).toBeUndefined();
		expect(result.content[0].text).toContain("⚠️");
		expect(result.content[0].text).toContain("unusually long");
	});

	it("does not warn for content under 80 lines", async () => {
		await write_expertise(test_dir, "small", "domain: small\nscope:\n  paths: []\n");

		const short_content = 'domain: small\ndescription: "Short"\nscope:\n  paths: []\n';
		const result = await execute({ action: "update", domain: "small", content: short_content }, test_dir);
		expect(result.content[0].text).not.toContain("⚠️");
	});
});

// ---------------------------------------------------------------------------
// append
// ---------------------------------------------------------------------------

describe("append action", () => {
	it("returns error when domain is missing", async () => {
		const result = await execute({ action: "append" }, test_dir);
		expect(result.details.error).toContain("domain is required");
	});

	it("returns error when section is missing", async () => {
		const result = await execute({ action: "append", domain: "test" }, test_dir);
		expect(result.details.error).toContain("section is required");
	});

	it("returns error when content is missing", async () => {
		const result = await execute({ action: "append", domain: "test", section: "gotchas" }, test_dir);
		expect(result.details.error).toContain("content is required");
	});

	it("appends to existing domain section", async () => {
		await write_expertise(test_dir, "appendable", SAMPLE_YAML);

		const result = await execute(
			{ action: "append", domain: "appendable", section: "gotchas", content: "New gotcha" },
			test_dir,
		);
		expect(result.details.error).toBeUndefined();
		expect(result.content[0].text).toContain("Appended");
		expect(result.details.section).toBe("gotchas");
	});

	it("propagates storage errors", async () => {
		const result = await execute(
			{ action: "append", domain: "nonexistent", section: "gotchas", content: "test" },
			test_dir,
		);
		expect(result.details.error).toContain("not found");
	});
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe("delete action", () => {
	it("returns error when domain is missing", async () => {
		const result = await execute({ action: "delete" }, test_dir);
		expect(result.details.error).toContain("domain is required");
	});

	it("returns error for non-existent domain", async () => {
		const result = await execute({ action: "delete", domain: "ghost" }, test_dir);
		expect(result.details.error).toContain("not found");
	});

	it("deletes existing domain", async () => {
		await write_expertise(test_dir, "doomed", "domain: doomed\nscope:\n  paths: []\n");

		const result = await execute({ action: "delete", domain: "doomed" }, test_dir);
		expect(result.details.error).toBeUndefined();
		expect(result.content[0].text).toContain("deleted");

		// Verify it's actually gone
		const get_result = await execute({ action: "get", domain: "doomed" }, test_dir);
		expect(get_result.details.error).toContain("not found");
	});
});

// ---------------------------------------------------------------------------
// renderCall
// ---------------------------------------------------------------------------

describe("renderCall", () => {
	const mock_theme = {
		fg: (_role: string, text: string) => text,
		bold: (text: string) => text,
	};

	it("renders action and domain", () => {
		const result = tool.renderCall({ action: "get", domain: "my-domain" }, mock_theme as any);
		expect(result).toBeDefined();
	});

	it("renders action without domain", () => {
		const result = tool.renderCall({ action: "list" }, mock_theme as any);
		expect(result).toBeDefined();
	});

	it("handles missing action gracefully", () => {
		const result = tool.renderCall({}, mock_theme as any);
		expect(result).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// renderResult
// ---------------------------------------------------------------------------

describe("renderResult", () => {
	const mock_theme = {
		fg: (_role: string, text: string) => text,
		bold: (text: string) => text,
	};

	it("renders list result collapsed", () => {
		const result = tool.renderResult(
			{
				content: [{ type: "text", text: "" }],
				details: {
					action: "list",
					domains: [{ domain: "test", description: "Test", last_synced: "2026-01-01", scope: { paths: [] } }],
				},
			},
			{ expanded: false, isPartial: false },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});

	it("renders list result expanded", () => {
		const result = tool.renderResult(
			{
				content: [{ type: "text", text: "" }],
				details: {
					action: "list",
					domains: [{ domain: "test", description: "Test desc", last_synced: "2026-01-01", scope: { paths: [] } }],
				},
			},
			{ expanded: true, isPartial: false },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});

	it("renders partial state", () => {
		const result = tool.renderResult(
			{ content: [], details: undefined },
			{ expanded: false, isPartial: true },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});

	it("renders error result", () => {
		const result = tool.renderResult(
			{ content: [{ type: "text", text: "Error: bad" }], details: { action: "get", error: "bad" } },
			{ expanded: false, isPartial: false },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});

	it("renders get result collapsed", () => {
		const result = tool.renderResult(
			{
				content: [{ type: "text", text: "" }],
				details: {
					action: "get",
					domain: "test",
					expertise: { domain: "test", raw: "domain: test\n", description: "", last_synced: "", scope: { paths: [] } },
				},
			},
			{ expanded: false, isPartial: false },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});

	it("renders empty domains list", () => {
		const result = tool.renderResult(
			{ content: [{ type: "text", text: "" }], details: { action: "list", domains: [] } },
			{ expanded: false, isPartial: false },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});

	it("renders each action type", () => {
		const actions_and_details = [
			{ action: "init", domain: "d" },
			{ action: "update", domain: "d" },
			{ action: "append", domain: "d", section: "gotchas" },
			{ action: "delete", domain: "d" },
		];

		for (const details of actions_and_details) {
			const result = tool.renderResult(
				{ content: [{ type: "text", text: "" }], details },
				{ expanded: false, isPartial: false },
				mock_theme as any,
			);
			expect(result).toBeDefined();
		}
	});

	it("handles missing details gracefully", () => {
		const result = tool.renderResult(
			{ content: [{ type: "text", text: "some output" }] },
			{ expanded: false, isPartial: false },
			mock_theme as any,
		);
		expect(result).toBeDefined();
	});
});
