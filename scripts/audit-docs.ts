/**
 * Docs Audit Script — `bun run audit`
 *
 * On-demand health check that catches documentation drift in the repository.
 * Separate from `bun run check` — invoked deliberately, not in pre-commit.
 *
 * ## Severity levels
 *
 * - **error** — provably wrong, no judgment needed → exit code 1
 * - **advisory** — heuristic flag, needs human review → exit code 0
 *
 * ## Check reference
 *
 * ### Errors (E1–E5) — exit 1 if any found
 *
 * | Key | Check                                    | Function                     | What it proves                                                    |
 * |-----|------------------------------------------|------------------------------|-------------------------------------------------------------------|
 * | E1  | Extension missing from README.md         | audit_extension_coverage     | Extension dir exists but is absent from the repo structure tree   |
 * | E2  | Extension missing from QUALITY.md        | audit_extension_coverage     | Extension dir exists but has no scorecard row                     |
 * | E3  | Completed plan still in active/          | audit_exec_plan_status       | Plan has Status: Complete(d) but hasn't been moved to completed/  |
 * | E4  | Phantom entry in exec-plan index         | audit_exec_plan_index        | Wikilink in README.md references a file that doesn't exist        |
 * | E5  | Plan file missing from exec-plan index   | audit_exec_plan_index        | File exists in active/ or completed/ but has no wikilink in index |
 *
 * ### Advisories (A1–A2) — exit 0, printed as info
 *
 * | Key | Check                                    | Function                     | What it flags                                                     |
 * |-----|------------------------------------------|------------------------------|-------------------------------------------------------------------|
 * | A1  | Last-updated date drift                  | audit_last_updated_dates     | Git commit date >7 days newer than documented "Last updated" date |
 * | A2  | All milestones complete in active plan   | audit_milestone_completion   | Every checkbox is [x] — plan may be ready to move to completed/   |
 *
 * ## Graceful degradation
 *
 * - A1 skips silently if not in a git repository
 * - Missing doc files (ARCHITECTURE.md, etc.) produce an advisory, not a crash
 */

import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type AuditFinding = {
	severity: "error" | "advisory";
	file_path: string;
	message: string;
	hint: string;
};

const SKIP_EXTENSION_DIRS = new Set(["__mocks__"]);
const SKIP_PLAN_FILES = new Set(["README.md", "TEMPLATE.md"]);

async function main() {
	const repo_root = process.cwd();
	const findings: AuditFinding[] = [];

	// Error checks (E1–E5)
	await audit_extension_coverage(repo_root, findings);
	await audit_exec_plan_status(repo_root, findings);
	await audit_exec_plan_index(repo_root, findings);

	// Advisory checks (A1–A2)
	await audit_last_updated_dates(repo_root, findings);
	await audit_milestone_completion(repo_root, findings);

	const errors = findings.filter((f) => f.severity === "error");
	const advisories = findings.filter((f) => f.severity === "advisory");

	if (errors.length === 0 && advisories.length === 0) {
		console.log("✅ Docs audit passed — no findings.");
		return;
	}

	if (errors.length > 0) {
		console.error(`❌ Docs audit found ${errors.length} error(s):`);
		for (const finding of errors) {
			console.error(`  [ERROR] ${finding.file_path}: ${finding.message}`);
			console.error(`    hint: ${finding.hint}`);
		}
	}

	if (advisories.length > 0) {
		const prefix = errors.length > 0 ? "\n" : "";
		console.log(`${prefix}ℹ️  Docs audit found ${advisories.length} advisory(ies):`);
		for (const finding of advisories) {
			console.log(`  [ADVISORY] ${finding.file_path}: ${finding.message}`);
			console.log(`    hint: ${finding.hint}`);
		}
	}

	if (errors.length > 0) {
		process.exitCode = 1;
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function push_finding(
	repo_root: string,
	findings: AuditFinding[],
	severity: "error" | "advisory",
	file_path: string,
	message: string,
	hint: string,
) {
	findings.push({
		severity,
		file_path: path.relative(repo_root, file_path),
		message,
		hint,
	});
}

async function safe_read_file(file_path: string): Promise<string | null> {
	try {
		return await readFile(file_path, "utf8");
	} catch {
		return null;
	}
}

async function list_extension_dirs(repo_root: string): Promise<string[]> {
	const extensions_dir = path.join(repo_root, "extensions");
	try {
		const entries = await readdir(extensions_dir, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory() && !SKIP_EXTENSION_DIRS.has(e.name)).map((e) => e.name);
	} catch {
		return [];
	}
}

async function list_plan_files(dir_path: string): Promise<string[]> {
	try {
		const entries = await readdir(dir_path, { withFileTypes: true });
		return entries
			.filter((e) => e.isFile() && e.name.endsWith(".md") && !SKIP_PLAN_FILES.has(e.name))
			.map((e) => e.name);
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// E1–E2: Extension coverage in README.md and QUALITY.md
// ---------------------------------------------------------------------------

async function audit_extension_coverage(repo_root: string, findings: AuditFinding[]) {
	const extension_names = await list_extension_dirs(repo_root);
	if (extension_names.length === 0) {
		return;
	}

	const readme_path = path.join(repo_root, "README.md");
	const quality_path = path.join(repo_root, "docs", "QUALITY.md");

	const readme_content = await safe_read_file(readme_path);
	const quality_content = await safe_read_file(quality_path);

	if (readme_content === null) {
		push_finding(
			repo_root,
			findings,
			"advisory",
			readme_path,
			"README.md not found",
			"Cannot check extension coverage without README.md.",
		);
		return;
	}
	if (quality_content === null) {
		push_finding(
			repo_root,
			findings,
			"advisory",
			quality_path,
			"QUALITY.md not found",
			"Cannot check extension coverage without docs/QUALITY.md.",
		);
		return;
	}

	for (const name of extension_names) {
		// E1: Extension in README.md structure
		if (!readme_content.includes(name)) {
			push_finding(
				repo_root,
				findings,
				"error",
				readme_path,
				`extension '${name}' missing from README.md structure`,
				`Add '${name}/' to the extensions listing in README.md so the repo overview stays accurate.`,
			);
		}

		// E2: Extension in QUALITY.md scorecard
		if (!quality_content.includes(name)) {
			push_finding(
				repo_root,
				findings,
				"error",
				quality_path,
				`extension '${name}' missing from QUALITY.md scorecard`,
				`Add a scorecard row for '${name}' in docs/QUALITY.md so quality posture is tracked.`,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// E3: Completed exec plan still in active/
// ---------------------------------------------------------------------------

async function audit_exec_plan_status(repo_root: string, findings: AuditFinding[]) {
	const active_dir = path.join(repo_root, "docs", "exec-plans", "active");
	const plan_files = await list_plan_files(active_dir);

	for (const file_name of plan_files) {
		const file_path = path.join(active_dir, file_name);
		const content = await safe_read_file(file_path);
		if (content === null) {
			continue;
		}

		// Match "Status: Complete" or "Status: Completed" (case-insensitive)
		if (/^Status:\s*Completed?\s*$/imu.test(content)) {
			push_finding(
				repo_root,
				findings,
				"error",
				file_path,
				"completed exec plan still in active/",
				"Move this file to docs/exec-plans/completed/ — its status is already marked complete.",
			);
		}
	}
}

// ---------------------------------------------------------------------------
// E4–E5: Exec plan index drift
// ---------------------------------------------------------------------------

async function audit_exec_plan_index(repo_root: string, findings: AuditFinding[]) {
	const index_path = path.join(repo_root, "docs", "exec-plans", "README.md");
	const index_content = await safe_read_file(index_path);
	if (index_content === null) {
		push_finding(
			repo_root,
			findings,
			"advisory",
			index_path,
			"exec-plans/README.md not found",
			"Cannot check plan index without docs/exec-plans/README.md.",
		);
		return;
	}

	// Extract all wikilink references: [[docs/exec-plans/active/...]] or [[docs/exec-plans/completed/...]]
	const wikilink_pattern = /\[\[docs\/exec-plans\/(active|completed)\/([^\]]+)\]\]/gu;
	const referenced_paths = new Set<string>();

	for (const match of index_content.matchAll(wikilink_pattern)) {
		const sub_dir = match[1];
		const slug = match[2];
		// Wikilinks may or may not have .md extension
		const file_name = slug.endsWith(".md") ? slug : `${slug}.md`;
		referenced_paths.add(`${sub_dir}/${file_name}`);
	}

	// E4: Phantom entries — referenced in index but file doesn't exist
	for (const ref_path of referenced_paths) {
		const full_path = path.join(repo_root, "docs", "exec-plans", ref_path);
		const content = await safe_read_file(full_path);
		if (content === null) {
			push_finding(
				repo_root,
				findings,
				"error",
				index_path,
				`phantom index entry: ${ref_path} does not exist on disk`,
				"Remove or update the stale reference in docs/exec-plans/README.md.",
			);
		}
	}

	// E5: Files missing from index
	const active_dir = path.join(repo_root, "docs", "exec-plans", "active");
	const completed_dir = path.join(repo_root, "docs", "exec-plans", "completed");

	const active_files = await list_plan_files(active_dir);
	const completed_files = await list_plan_files(completed_dir);

	for (const file_name of active_files) {
		const ref_key = `active/${file_name}`;
		if (!referenced_paths.has(ref_key)) {
			push_finding(
				repo_root,
				findings,
				"error",
				path.join(active_dir, file_name),
				"active exec plan missing from index",
				"Add this plan to the active section of docs/exec-plans/README.md.",
			);
		}
	}

	for (const file_name of completed_files) {
		const ref_key = `completed/${file_name}`;
		if (!referenced_paths.has(ref_key)) {
			push_finding(
				repo_root,
				findings,
				"error",
				path.join(completed_dir, file_name),
				"completed exec plan missing from index",
				"Add this plan to the completed section of docs/exec-plans/README.md.",
			);
		}
	}
}

// ---------------------------------------------------------------------------
// A1: Last-updated date drift
// ---------------------------------------------------------------------------

async function audit_last_updated_dates(repo_root: string, findings: AuditFinding[]) {
	// Check if we're in a git repo
	const git_check = spawnSync("git", ["rev-parse", "--git-dir"], {
		cwd: repo_root,
		encoding: "utf8",
		timeout: 5_000,
	});

	if (git_check.status !== 0) {
		console.log("(skipping git date checks — not a git repository)");
		return;
	}

	const tracked_files = [
		path.join(repo_root, "docs", "ARCHITECTURE.md"),
		path.join(repo_root, "docs", "QUALITY.md"),
		path.join(repo_root, "docs", "exec-plans", "tech-debt-tracker.md"),
	];

	for (const file_path of tracked_files) {
		const content = await safe_read_file(file_path);
		if (content === null) {
			continue;
		}

		// Extract "Last updated: YYYY-MM-DD"
		const date_match = content.match(/^Last updated:\s*(\d{4}-\d{2}-\d{2})/mu);
		if (!date_match) {
			continue;
		}

		const documented_date = new Date(date_match[1]);

		// Get last git commit date for this file
		const git_log = spawnSync("git", ["log", "-1", "--format=%aI", "--", file_path], {
			cwd: repo_root,
			encoding: "utf8",
			timeout: 5_000,
		});

		if (git_log.status !== 0 || !git_log.stdout?.trim()) {
			continue;
		}

		const git_date = new Date(git_log.stdout.trim());
		const drift_days = Math.floor((git_date.getTime() - documented_date.getTime()) / (1000 * 60 * 60 * 24));

		if (drift_days > 7) {
			const git_date_str = git_date.toISOString().slice(0, 10);
			push_finding(
				repo_root,
				findings,
				"advisory",
				file_path,
				`Last updated says ${date_match[1]} but file was last modified ${git_date_str} (${drift_days} days newer)`,
				"Update the 'Last updated' header to reflect the most recent edit date.",
			);
		}
	}
}

// ---------------------------------------------------------------------------
// A2: All milestones complete in active plan
// ---------------------------------------------------------------------------

async function audit_milestone_completion(repo_root: string, findings: AuditFinding[]) {
	const active_dir = path.join(repo_root, "docs", "exec-plans", "active");
	const plan_files = await list_plan_files(active_dir);

	for (const file_name of plan_files) {
		const file_path = path.join(active_dir, file_name);
		const content = await safe_read_file(file_path);
		if (content === null) {
			continue;
		}

		// Find all checkbox lines: - [ ] or - [x]
		const unchecked = content.match(/^-\s+\[\s\]/gmu) ?? [];
		const checked = content.match(/^-\s+\[x\]/gimu) ?? [];

		// Only flag if there are checkboxes and ALL are checked
		if (checked.length > 0 && unchecked.length === 0) {
			push_finding(
				repo_root,
				findings,
				"advisory",
				file_path,
				"all milestones are checked off in active plan",
				"Consider marking Status: Completed and moving to docs/exec-plans/completed/.",
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`❌ Docs audit crashed: ${message}`);
	process.exitCode = 1;
});
