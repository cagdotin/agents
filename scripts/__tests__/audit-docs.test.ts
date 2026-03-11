import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let tmp_dir: string;
let test_dir: string;
let test_counter = 0;

const audit_script_path = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "audit-docs.ts");

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "audit-docs-test-"));
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
// Fixture helpers
// ---------------------------------------------------------------------------

const ARCHITECTURE_CONTENT = `# ARCHITECTURE

## Codemap

### \`extensions/\`

Extensions live under this directory.
`;

const README_CONTENT = `# Agents

## Structure

\`\`\`
agents/
├── extensions/
│   ├── alpha/
│   └── beta/
\`\`\`
`;

const QUALITY_CONTENT = `# QUALITY

Status: active
Last updated: 2026-03-01

## Component Scorecard

| Area | Score | Status | Notes |
|---|---:|---|---|
| \`extensions/alpha\` | 3 | Good | Solid |
| \`extensions/beta\` | 3 | Good | Solid |
`;

const INDEX_CONTENT = `# Execution Plans

## Current active plans

- [[docs/exec-plans/active/2026-01-01-plan-a]] — Plan A

## Recently completed

- [[docs/exec-plans/completed/2026-01-01-plan-b]] — Plan B
`;

const ACTIVE_PLAN_CONTENT = `# Plan A

Status: Active

## Progress

- [ ] Milestone 1
- [x] Milestone 2
`;

const COMPLETED_PLAN_CONTENT = `# Plan B

Status: Completed

## Outcomes

Done.
`;

async function write_clean_fixture(repo_dir: string): Promise<void> {
	await mkdir(path.join(repo_dir, "extensions", "alpha"), { recursive: true });
	await mkdir(path.join(repo_dir, "extensions", "beta"), { recursive: true });
	await mkdir(path.join(repo_dir, "docs", "exec-plans", "active"), { recursive: true });
	await mkdir(path.join(repo_dir, "docs", "exec-plans", "completed"), { recursive: true });

	await writeFile(path.join(repo_dir, "docs", "ARCHITECTURE.md"), ARCHITECTURE_CONTENT);
	await writeFile(path.join(repo_dir, "README.md"), README_CONTENT);
	await writeFile(path.join(repo_dir, "docs", "QUALITY.md"), QUALITY_CONTENT);
	await writeFile(path.join(repo_dir, "docs", "exec-plans", "README.md"), INDEX_CONTENT);
	await writeFile(path.join(repo_dir, "docs", "exec-plans", "active", "2026-01-01-plan-a.md"), ACTIVE_PLAN_CONTENT);
	await writeFile(
		path.join(repo_dir, "docs", "exec-plans", "completed", "2026-01-01-plan-b.md"),
		COMPLETED_PLAN_CONTENT,
	);
}

function run_audit(repo_dir: string) {
	return spawnSync("bun", [audit_script_path], {
		cwd: repo_dir,
		encoding: "utf8",
		timeout: 15_000,
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scripts/audit-docs.ts", () => {
	it("passes for a clean fixture", async () => {
		await write_clean_fixture(test_dir);

		const result = run_audit(test_dir);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Docs audit passed");
	});

	// ------- E1: Extension missing from README.md -------

	it("reports extension missing from README.md (E1)", async () => {
		await write_clean_fixture(test_dir);
		await mkdir(path.join(test_dir, "extensions", "gamma"), { recursive: true });

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("extension 'gamma' missing from README.md structure");
	});

	// ------- E2: Extension missing from QUALITY.md -------

	it("reports extension missing from QUALITY.md (E2)", async () => {
		await write_clean_fixture(test_dir);
		await mkdir(path.join(test_dir, "extensions", "gamma"), { recursive: true });

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("extension 'gamma' missing from QUALITY.md scorecard");
	});

	// ------- E3: Completed plan in active/ -------

	it("reports completed plan still in active/ (E3)", async () => {
		await write_clean_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-01-02-done.md"),
			"# Done Plan\n\nStatus: Completed\n\n## Outcomes\nDone.\n",
		);
		// Also add to index so we don't get E5
		const index = `${INDEX_CONTENT}\n- [[docs/exec-plans/active/2026-01-02-done]] — Done plan\n`;
		await writeFile(path.join(test_dir, "docs", "exec-plans", "README.md"), index);

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("completed exec plan still in active/");
	});

	it("detects case-insensitive status: complete (E3)", async () => {
		await write_clean_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-01-02-done.md"),
			"# Done Plan\n\nStatus: complete\n\n## Outcomes\nDone.\n",
		);
		const index = `${INDEX_CONTENT}\n- [[docs/exec-plans/active/2026-01-02-done]] — Done plan\n`;
		await writeFile(path.join(test_dir, "docs", "exec-plans", "README.md"), index);

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("completed exec plan still in active/");
	});

	// ------- E4: Phantom index entry -------

	it("reports phantom index entry (E4)", async () => {
		await write_clean_fixture(test_dir);
		// Add a reference to a plan that doesn't exist
		const index = `${INDEX_CONTENT}\n- [[docs/exec-plans/active/2026-99-99-ghost]] — Ghost plan\n`;
		await writeFile(path.join(test_dir, "docs", "exec-plans", "README.md"), index);

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("phantom index entry");
		expect(result.stderr).toContain("2026-99-99-ghost");
	});

	// ------- E5: Plan file missing from index -------

	it("reports plan file missing from index (E5)", async () => {
		await write_clean_fixture(test_dir);
		// Add an active plan file that's not referenced in the index
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-01-03-orphan.md"),
			"# Orphan\n\nStatus: Active\n\n## Progress\n\n- [ ] Step 1\n",
		);

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("active exec plan missing from index");
		expect(result.stderr).toContain("2026-01-03-orphan");
	});

	it("reports completed plan file missing from index (E5)", async () => {
		await write_clean_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "completed", "2026-01-03-orphan.md"),
			"# Orphan\n\nStatus: Completed\n",
		);

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("completed exec plan missing from index");
	});

	// ------- A2: All milestones complete in active plan -------

	it("reports advisory when all milestones are complete (A2)", async () => {
		await write_clean_fixture(test_dir);
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-01-01-plan-a.md"),
			"# Plan A\n\nStatus: Active\n\n## Progress\n\n- [x] Milestone 1\n- [x] Milestone 2\n",
		);

		const result = run_audit(test_dir);
		expect(result.status).toBe(0); // advisories don't cause exit 1
		expect(result.stdout).toContain("all milestones are checked off");
	});

	// ------- Advisory-only exits 0 -------

	it("exits 0 when only advisories are present", async () => {
		await write_clean_fixture(test_dir);
		// All milestones complete → advisory only
		await writeFile(
			path.join(test_dir, "docs", "exec-plans", "active", "2026-01-01-plan-a.md"),
			"# Plan A\n\nStatus: Active\n\n## Progress\n\n- [x] Milestone 1\n- [x] Milestone 2\n",
		);

		const result = run_audit(test_dir);
		expect(result.status).toBe(0);
		expect(result.stderr).not.toContain("[ERROR]");
		expect(result.stdout).toContain("[ADVISORY]");
	});

	// ------- Multiple errors at once -------

	it("reports multiple errors for a new unregistered extension", async () => {
		await write_clean_fixture(test_dir);
		await mkdir(path.join(test_dir, "extensions", "phantom"), { recursive: true });

		const result = run_audit(test_dir);
		expect(result.status).toBe(1);
		// Should get E1 and E2 together
		expect(result.stderr).toContain("missing from README.md");
		expect(result.stderr).toContain("missing from QUALITY.md");
	});

	// ------- Skips __mocks__ -------

	it("skips __mocks__ directory in extensions", async () => {
		await write_clean_fixture(test_dir);
		await mkdir(path.join(test_dir, "extensions", "__mocks__"), { recursive: true });

		const result = run_audit(test_dir);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Docs audit passed");
	});
});
