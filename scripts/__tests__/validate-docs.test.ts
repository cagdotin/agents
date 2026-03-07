import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
	await mkdir(path.join(repo_dir, "docs", "resources"), { recursive: true });
	await mkdir(path.join(repo_dir, "skills", "plan"), { recursive: true });
	await mkdir(path.join(repo_dir, "extensions", "demo"), { recursive: true });

	await writeFile(
		path.join(repo_dir, "docs", "resources", "sample.md"),
		`---
title: Sample Resource
type: article
source: web
url: https://example.com/resource
author: Example Author
date_captured: 2026-03-07
tags:
  - agents
status: reviewed
description: Sample description
---

# Sample
`,
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

	it("reports invalid resource frontmatter yaml", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "resources", "sample.md"),
			`---
title: "broken
tags:
  - good
---
`,
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("invalid frontmatter YAML");
	});

	it("reports invalid resource contract fields", async () => {
		await write_valid_repo_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "resources", "sample.md"),
			`---
title: Sample Resource
type: article
source: web
url: not-a-url
author: Example Author
date_captured: 07-03-2026
tags: []
status: reviewed
description: Sample description
---
`,
		);

		const result = run_validator(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("invalid url field");
		expect(result.stderr).toContain("invalid date_captured format");
		expect(result.stderr).toContain("missing required frontmatter field: tags");
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
});
