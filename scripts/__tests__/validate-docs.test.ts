import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

let tmp_dir: string;
let test_dir: string;
let test_counter = 0;

const validator_script_path = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "validate-docs.ts");

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "validate-docs-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(async () => {
	test_counter += 1;
	test_dir = path.join(tmp_dir, `sub-${test_counter}`);
	await mkdir(test_dir, { recursive: true });
});

async function write_valid_repo_fixture(repo_dir: string): Promise<void> {
	await mkdir(path.join(repo_dir, "docs", "exec-plans", "active"), { recursive: true });
	await mkdir(path.join(repo_dir, "docs", "references"), { recursive: true });
	await mkdir(path.join(repo_dir, "docs", "specs"), { recursive: true });
	await mkdir(path.join(repo_dir, "skills", "plan"), { recursive: true });
	await mkdir(path.join(repo_dir, "extensions", "demo"), { recursive: true });

	await writeFile(path.join(repo_dir, "README.md"), "# Repo\n");
	await writeFile(path.join(repo_dir, "AGENTS.md"), "# Agent Notes\n");
	await writeFile(path.join(repo_dir, "CONTEXT.md"), "# Context\n");
	await writeFile(
		path.join(repo_dir, "package.json"),
		JSON.stringify({ name: "fixture", scripts: { check: "pnpm run check:docs" } }),
	);

	await writeFile(path.join(repo_dir, "docs", "README.md"), "# Docs\n");
	await writeFile(path.join(repo_dir, "docs", "ARCHITECTURE.md"), "# ARCHITECTURE\n");
	await writeFile(path.join(repo_dir, "docs", "DESIGN-PRINCIPLES.md"), "# Design Principles\n");
	await writeFile(path.join(repo_dir, "docs", "coding-conventions.md"), "# Coding conventions\n");
	await writeFile(path.join(repo_dir, "docs", "TESTING.md"), "# TESTING\n");
	await writeFile(path.join(repo_dir, "docs", "references", "README.md"), "# References\n");
	await writeFile(path.join(repo_dir, "docs", "references", "pi-api-reference.md"), "# Pi API Reference\n");
	await writeFile(path.join(repo_dir, "docs", "specs", "README.md"), "# Specs\n");
	await writeFile(
		path.join(repo_dir, "docs", "exec-plans", "README.md"),
		"# Execution Plans\n\n## Current active plans\n\n- [[docs/exec-plans/active/2026-04-30-sample-plan]]\n",
	);
	await writeFile(
		path.join(repo_dir, "docs", "exec-plans", "active", "2026-04-30-sample-plan.md"),
		"# Sample plan\n\nStatus: Active\n",
	);

	await writeFile(
		path.join(repo_dir, "skills", "plan", "SKILL.md"),
		`---
name: plan
description: Test skill
---

# Plan skill
`,
	);
	await writeFile(path.join(repo_dir, "skills", "plan", "PLAN.md"), "# Plan\n");

	await writeFile(
		path.join(repo_dir, "extensions", "demo", "README.md"),
		`# Demo Extension

## Behavior
This extension exists only for validation tests. It explains behavior, trigger flow, and design intent so agents can orient quickly without digging through source files. The behavior section intentionally uses clear prose and concrete details that mirror real extension documentation.

## Usage
Use this extension in test fixtures that exercise documentation checks. The README documents expected usage, command entry points, setup assumptions, and how maintainers should reason about troubleshooting output. We also include enough contextual language that the file remains agent-legible and realistic.

## Requirements
No runtime dependencies are needed, but the README must stay rich enough for quality gates. Keep sections descriptive, include practical guidance, and avoid one-line placeholders. This paragraph is deliberately verbose so the fixture exceeds minimum word-count requirements while staying coherent and useful.
`,
	);
}

function run_validator(repo_dir: string) {
	return spawnSync("bun", [validator_script_path], {
		cwd: repo_dir,
		encoding: "utf8",
	});
}

describe("scripts/validate-docs.ts", () => {
	it("passes for valid docs fixtures", async () => {
		await write_valid_repo_fixture(test_dir);

		const result = run_validator(test_dir);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Documentation validation passed");
	});

	it("reports missing required documentation surfaces", async () => {
		await write_valid_repo_fixture(test_dir);
		await rm(path.join(test_dir, "docs", "coding-conventions.md"));

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing required documentation surface: docs/coding-conventions.md");
	});

	it("reports forbidden documentation surfaces", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(path.join(test_dir, "docs", "QUALITY.md"), "# QUALITY\n");

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("forbidden documentation surface still exists: docs/QUALITY.md");
	});

	it("reports forbidden completed exec-plan directory", async () => {
		await write_valid_repo_fixture(test_dir);
		await mkdir(path.join(test_dir, "docs", "exec-plans", "completed"), { recursive: true });

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("forbidden documentation surface still exists: docs/exec-plans/completed");
	});

	it("reports unexpected shared references", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(path.join(test_dir, "docs", "references", "conditional-feature-registration.md"), "# Legacy\n");

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("unexpected shared reference file: conditional-feature-registration.md");
	});

	it("reports active plans missing from the index", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-04-30-extra-plan.md"),
			"# Extra plan\n\nStatus: Active\n",
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("active exec plan missing from docs/exec-plans/README.md");
	});

	it("reports completed status files left in active/", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-04-30-sample-plan.md"),
			"# Sample plan\n\nStatus: Completed\n",
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("completed exec plan still lives in active/");
	});

	it("reports missing skill required fields", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "skills", "plan", "SKILL.md"),
			`---
name: plan
---
`,
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing required frontmatter field: description");
	});

	it("reports skill name mismatch", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "skills", "plan", "SKILL.md"),
			`---
name: planner
description: Test skill
---
`,
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("does not match directory name");
	});

	it("passes for nested categorized skills", async () => {
		await write_valid_repo_fixture(test_dir);
		await mkdir(path.join(test_dir, "skills", "productivity", "caveman"), { recursive: true });
		await writeFile(path.join(test_dir, "skills", "productivity", "README.md"), "# Productivity\n");
		await writeFile(
			path.join(test_dir, "skills", "productivity", "caveman", "SKILL.md"),
			`---
name: caveman
description: Terse response mode
---

# Caveman
`,
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Documentation validation passed");
	});
});
