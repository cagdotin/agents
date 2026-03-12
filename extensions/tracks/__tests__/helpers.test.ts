import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	build_track_argument_completions,
	build_track_context_injection,
	build_track_context_message,
	build_track_summary_markdown,
	build_track_trace_entry,
	clear_active_track_if_matches,
	end_track_record,
	get_latest_track_trace,
	get_session_track_slug,
	mark_session_active,
	restore_track_status,
	serialize_track_for_agent,
	serialize_track_list_for_agent,
	sync_track_record,
} from "../helpers.js";
import {
	create_track_workspace,
	get_tracks_dir,
	read_track_file,
	set_active_track,
	write_track_file,
} from "../storage.js";
import type { TrackRecord } from "../types.js";

const temp_dirs: string[] = [];

async function create_temp_cwd(): Promise<string> {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "tracks-helpers-"));
	temp_dirs.push(cwd);
	return cwd;
}

function make_track_record(overrides: Partial<TrackRecord> = {}): TrackRecord {
	return {
		slug: "test-track",
		dir: "/tmp/test-track",
		metadata: {
			name: "test-track",
			purpose: "A test track",
			status: "active",
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-01T00:00:00Z",
			last_synced_at: "2026-01-01T00:00:00Z",
			related_paths: [],
			session_count: 1,
			summary_version: 1,
		},
		missing_files: [],
		is_active: false,
		...overrides,
	};
}

afterEach(async () => {
	await Promise.all(temp_dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("mark_session_active", () => {
	it("marks track active when slug matches session track", () => {
		const record = make_track_record({ slug: "my-track", is_active: false });
		const result = mark_session_active(record, "my-track");
		expect(result.is_active).toBe(true);
		// Original should be unchanged (immutable)
		expect(record.is_active).toBe(false);
	});

	it("marks track inactive when slug does not match", () => {
		const record = make_track_record({ slug: "my-track", is_active: true });
		const result = mark_session_active(record, "other-track");
		expect(result.is_active).toBe(false);
	});

	it("marks track inactive when session track is undefined", () => {
		const record = make_track_record({ slug: "my-track", is_active: true });
		const result = mark_session_active(record, undefined);
		expect(result.is_active).toBe(false);
	});
});

describe("serialize_track_for_agent", () => {
	it("serializes a track record into agent-readable text", () => {
		const record = make_track_record({
			slug: "demo",
			is_active: true,
			metadata: {
				name: "demo",
				purpose: "Build a demo",
				status: "active",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
				last_synced_at: "2026-03-11T17:00:00Z",
				related_paths: ["src/index.ts"],
				session_count: 3,
				summary_version: 1,
			},
		});
		const text = serialize_track_for_agent(record);
		expect(text).toContain("Track: demo");
		expect(text).toContain("Purpose: Build a demo");
		expect(text).toContain("Active: yes");
		expect(text).toContain("Missing files: none");
		expect(text).toContain("- src/index.ts");
	});

	it("shows missing files when present", () => {
		const record = make_track_record({ missing_files: ["tasks.md", "findings.md"] });
		const text = serialize_track_for_agent(record);
		expect(text).toContain("Missing files: tasks.md, findings.md");
	});

	it("omits related paths section when empty", () => {
		const record = make_track_record();
		const text = serialize_track_for_agent(record);
		expect(text).not.toContain("Related paths:");
	});
});

describe("serialize_track_list_for_agent", () => {
	it("returns empty message for no tracks", () => {
		expect(serialize_track_list_for_agent([])).toBe("No tracks found.");
	});

	it("marks active track with asterisk", () => {
		const tracks = [
			make_track_record({ slug: "alpha", is_active: false }),
			make_track_record({ slug: "beta", is_active: true }),
		];
		const text = serialize_track_list_for_agent(tracks);
		expect(text).toContain("- alpha");
		expect(text).toContain("* beta");
	});

	it("shows missing files in list", () => {
		const tracks = [make_track_record({ slug: "broken", missing_files: ["report.md"] })];
		const text = serialize_track_list_for_agent(tracks);
		expect(text).toContain("missing: report.md");
	});
});

describe("build_track_context_message", () => {
	it("creates a display message with track details", () => {
		const record = make_track_record({ slug: "ctx-test" });
		const message = build_track_context_message(record);
		expect(message.customType).toBe("track-context-loaded");
		expect(message.display).toBe(true);
		expect(message.content).toContain("ctx-test");
		expect(message.details.track).toBe("ctx-test");
		expect(message.details.purpose).toBe("A test track");
		expect(message.details.status).toBe("active");
	});
});

describe("build_track_trace_entry", () => {
	it("builds a set-active trace entry", () => {
		const entry = build_track_trace_entry("set-active", "my-track");
		expect(entry.action).toBe("set-active");
		expect(entry.track).toBe("my-track");
		expect(entry.status).toBeUndefined();
		expect(entry.timestamp).toBeTruthy();
	});

	it("builds an end trace entry with closed status", () => {
		const entry = build_track_trace_entry("end", "closing", "closed");
		expect(entry.action).toBe("end");
		expect(entry.track).toBe("closing");
		expect(entry.status).toBe("closed");
	});
});

describe("tracks helpers", () => {
	it("builds track argument completions that preserve the sub-command", () => {
		const completions = build_track_argument_completions(
			"use tra",
			[
				{
					slug: "track-extension",
					dir: "/tmp/track-extension",
					metadata: {
						name: "track-extension",
						purpose: "Fix track completion behavior",
						status: "active",
						created_at: "2026-03-11T17:00:00Z",
						updated_at: "2026-03-11T17:00:00Z",
						last_synced_at: "2026-03-11T17:00:00Z",
						related_paths: [],
						summary_version: 1,
					},
					missing_files: [],
					is_active: false,
				},
			],
			(value) => value.split(/\s+/).filter(Boolean),
		);

		expect(completions).toEqual([
			{
				value: "use track-extension",
				label: "track-extension",
				description: "active · Fix track completion behavior",
			},
		]);
	});

	it("returns null for completions on non-track sub-commands", () => {
		const completions = build_track_argument_completions("new ", [make_track_record({ slug: "test" })], (value) =>
			value.split(/\s+/).filter(Boolean),
		);
		expect(completions).toBeNull();
	});

	it("completes sub-commands when no sub-command is typed yet", () => {
		const completions = build_track_argument_completions("", [], (value) => value.split(/\s+/).filter(Boolean));
		expect(completions).not.toBeNull();
		expect(completions!.map((c) => c.value)).toContain("list");
		expect(completions!.map((c) => c.value)).toContain("new");
		expect(completions!.map((c) => c.value)).toContain("use");
	});

	it("builds a deterministic summary from task files", () => {
		const summary = build_track_summary_markdown({
			slug: "demo",
			metadata: {
				name: "demo",
				purpose: "Validate deterministic snapshots",
				status: "active",
				created_at: "2026-03-11T17:00:00Z",
				updated_at: "2026-03-11T17:00:00Z",
				last_synced_at: "2026-03-11T17:00:00Z",
				related_paths: ["docs/spec.md"],
				session_count: 2,
				summary_version: 1,
			},
			tasks_md: "# Tasks\n\n- [ ] Ship the command\n- Draft README\n",
			findings_md: "# Findings\n\n- Hooks should stay repo-agnostic.\n",
			decisions_md: "# Decisions\n\n- Use deterministic sync in v1.\n",
			report_md: "# Report\n\nThe command wiring is in progress and the storage layer is stable.\n",
		});

		expect(summary).toContain("Track: demo");
		expect(summary).toContain("- Ship the command");
		expect(summary).toContain("- Hooks should stay repo-agnostic.");
		expect(summary).toContain("The command wiring is in progress");
	});

	it("renders fallback text when all source files are empty", () => {
		const summary = build_track_summary_markdown({
			slug: "empty",
			metadata: {
				name: "empty",
				purpose: "Test fallbacks",
				status: "active",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
				last_synced_at: "2026-01-01T00:00:00Z",
				related_paths: [],
				session_count: 0,
				summary_version: 1,
			},
			tasks_md: "",
			findings_md: "",
			decisions_md: "",
			report_md: "",
		});

		expect(summary).toContain("No next steps captured yet.");
		expect(summary).toContain("No open checklist items captured yet.");
		expect(summary).toContain("No durable findings captured yet.");
		expect(summary).toContain("No decisions captured yet.");
		expect(summary).toContain("No report update captured yet.");
		expect(summary).toContain("- none recorded");
	});

	it("extracts only unchecked checkboxes for the open checklist section", () => {
		const summary = build_track_summary_markdown({
			slug: "checkbox",
			metadata: {
				name: "checkbox",
				purpose: "Test checkbox filtering",
				status: "active",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
				last_synced_at: "2026-01-01T00:00:00Z",
				related_paths: [],
				session_count: 0,
				summary_version: 1,
			},
			tasks_md: "# Tasks\n\n- [x] Done task\n- [ ] Open task\n- [X] Also done\n- [ ] Another open\n- Regular bullet\n",
			findings_md: "",
			decisions_md: "",
			report_md: "",
		});

		// Open checklist should only contain unchecked items
		const checklist_section = summary.split("## Open checklist")[1]?.split("## ")[0] ?? "";
		expect(checklist_section).toContain("Open task");
		expect(checklist_section).toContain("Another open");
		expect(checklist_section).not.toContain("Done task");
		expect(checklist_section).not.toContain("Also done");

		// Next steps should include all items (bullets and checkboxes)
		const next_steps_section = summary.split("## Next steps")[1]?.split("## ")[0] ?? "";
		expect(next_steps_section).toContain("Open task");
		expect(next_steps_section).toContain("Regular bullet");
	});

	it("extracts report pulse from paragraph text, falling back to bullets", () => {
		// Paragraph extraction
		const with_paragraph = build_track_summary_markdown({
			slug: "pulse",
			metadata: {
				name: "pulse",
				purpose: "test",
				status: "active",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
				last_synced_at: "2026-01-01T00:00:00Z",
				related_paths: [],
				session_count: 0,
				summary_version: 1,
			},
			tasks_md: "",
			findings_md: "",
			decisions_md: "",
			report_md: "# Report\n\nEverything is on track and looking good.\n",
		});
		const pulse_section = with_paragraph.split("## Report pulse")[1] ?? "";
		expect(pulse_section).toContain("Everything is on track");

		// Bullet fallback when no paragraph
		const with_bullets = build_track_summary_markdown({
			slug: "pulse2",
			metadata: {
				name: "pulse2",
				purpose: "test",
				status: "active",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
				last_synced_at: "2026-01-01T00:00:00Z",
				related_paths: [],
				session_count: 0,
				summary_version: 1,
			},
			tasks_md: "",
			findings_md: "",
			decisions_md: "",
			report_md: "# Report\n\n- First update\n- Second update\n- Third update\n",
		});
		const bullet_section = with_bullets.split("## Report pulse")[1] ?? "";
		expect(bullet_section).toContain("First update");
		expect(bullet_section).toContain("Second update");
	});

	it("sync regenerates summary.md and end finalizes report.md", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "Demo",
			purpose: "Exercise sync and end",
		});

		await fs.writeFile(path.join(track.dir, "tasks.md"), "# Tasks\n\n- [ ] Finish testing\n- Update docs\n", "utf8");
		await fs.writeFile(path.join(track.dir, "report.md"), "# Report\n\nWork is underway.\n", "utf8");
		await fs.writeFile(path.join(track.dir, "findings.md"), "# Findings\n\n- Keep this portable.\n", "utf8");
		await fs.writeFile(path.join(track.dir, "decisions.md"), "# Decisions\n\n- Sync stays deterministic.\n", "utf8");

		const synced = await sync_track_record(tracks_dir, track.slug);
		const summary_md = await read_track_file(synced.dir, "summary.md");
		expect(summary_md).toContain("Finish testing");
		expect(summary_md).toContain("Keep this portable.");

		const ended = await end_track_record(tracks_dir, track.slug);
		const report_md = await read_track_file(ended.dir, "report.md");
		const ended_summary = await read_track_file(ended.dir, "summary.md");
		expect(report_md).toContain("## Closeout");
		expect(ended_summary).toContain("Status: closed");
	});

	it("end is idempotent — re-ending replaces the closeout block", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "idempotent",
			purpose: "Test re-closing",
		});

		await write_track_file(track.dir, "report.md", "# Report\n\nFinal notes.\n");

		const first_end = await end_track_record(tracks_dir, track.slug);
		const first_report = await read_track_file(first_end.dir, "report.md");
		expect(first_report).toContain("## Closeout");
		const closeout_count_1 = (first_report.match(/## Closeout/g) ?? []).length;
		expect(closeout_count_1).toBe(1);

		// Re-open and re-close (simulate manual status change + re-end)
		await fs.writeFile(
			path.join(track.dir, "track.yaml"),
			(await fs.readFile(path.join(track.dir, "track.yaml"), "utf8")).replace("status: closed", "status: active"),
			"utf8",
		);
		const second_end = await end_track_record(tracks_dir, track.slug);
		const second_report = await read_track_file(second_end.dir, "report.md");
		const closeout_count_2 = (second_report.match(/## Closeout/g) ?? []).length;
		expect(closeout_count_2).toBe(1);
		expect(second_report).toContain("Final notes.");
	});

	it("extracts the latest valid track trace from session entries", () => {
		const trace = get_latest_track_trace([
			{ type: "custom", customType: "other", data: { value: 1 } },
			{
				type: "custom",
				customType: "track-state",
				data: { action: "set-active", track: "demo", timestamp: "2026-03-11T17:00:00Z" },
			},
			{
				type: "custom",
				customType: "track-state",
				data: { action: "end", track: "demo", status: "closed", timestamp: "2026-03-11T18:00:00Z" },
			},
		]);

		expect(trace).toEqual({ action: "end", track: "demo", status: "closed", timestamp: "2026-03-11T18:00:00Z" });
	});

	it("returns undefined for empty branch or no track traces", () => {
		expect(get_latest_track_trace([])).toBeUndefined();
		expect(
			get_latest_track_trace([
				{ type: "user", data: "hello" },
				{ type: "custom", customType: "unrelated", data: {} },
			]),
		).toBeUndefined();
	});

	it("skips malformed trace entries and returns the last valid one", () => {
		const trace = get_latest_track_trace([
			{
				type: "custom",
				customType: "track-state",
				data: { action: "set-active", track: "good", timestamp: "2026-01-01T00:00:00Z" },
			},
			{
				type: "custom",
				customType: "track-state",
				data: { action: "invalid-action", track: "bad" },
			},
		]);

		expect(trace).toEqual({ action: "set-active", track: "good", timestamp: "2026-01-01T00:00:00Z" });
	});

	it("resolves the session-attached track only from session traces", () => {
		expect(
			get_session_track_slug([
				{
					type: "custom",
					customType: "track-state",
					data: { action: "set-active", track: "demo", timestamp: "2026-03-11T17:00:00Z" },
				},
			]),
		).toBe("demo");

		expect(
			get_session_track_slug([
				{
					type: "custom",
					customType: "track-state",
					data: { action: "set-active", track: "demo", timestamp: "2026-03-11T17:00:00Z" },
				},
				{
					type: "custom",
					customType: "track-state",
					data: { action: "clear-active", track: "demo", timestamp: "2026-03-11T18:00:00Z" },
				},
			]),
		).toBeUndefined();
	});

	it("builds a compact active-track injection", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "Demo",
			purpose: "Build context injection",
		});
		await set_active_track(tracks_dir, track.slug);
		const agents_md = "# Track\n\nRead summary first.";
		const summary_md = "# Summary\n\nCurrent truth.";
		const injection = build_track_context_injection(
			{
				...track,
				is_active: true,
				missing_files: [],
			},
			agents_md,
			summary_md,
		);
		expect(injection).toContain("# Active Track");
		expect(injection).toContain("Read summary first.");
		expect(injection).toContain("Current truth.");
		expect(injection).toContain('<track name="demo"');
		expect(injection).toContain('status="active"');
	});
});

describe("clear_active_track_if_matches", () => {
	it("clears the active track when slug matches", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "target", purpose: "clear test" });
		await set_active_track(tracks_dir, "target");

		const cleared = await clear_active_track_if_matches(tracks_dir, "target");
		expect(cleared).toBe(true);
	});

	it("does not clear when slug does not match", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "target", purpose: "clear test" });
		await set_active_track(tracks_dir, "target");

		const cleared = await clear_active_track_if_matches(tracks_dir, "other");
		expect(cleared).toBe(false);
	});

	it("returns false when no track is active", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "target", purpose: "clear test" });

		const cleared = await clear_active_track_if_matches(tracks_dir, "target");
		expect(cleared).toBe(false);
	});
});

describe("restore_track_status", () => {
	function make_mock_ctx(cwd: string, branch: Array<{ type: string; customType?: string; data?: unknown }> = []) {
		const status_updates: Array<{ key: string; value: string | undefined }> = [];
		const notifications: Array<{ message: string; level: string }> = [];
		return {
			ctx: {
				cwd,
				sessionManager: { getBranch: () => branch },
				ui: {
					setStatus: (key: string, value: string | undefined) => {
						status_updates.push({ key, value });
					},
					notify: (message: string, level: string) => {
						notifications.push({ message, level });
					},
				},
			},
			status_updates,
			notifications,
		};
	}

	it("clears status when no track is attached to the session", async () => {
		const cwd = await create_temp_cwd();
		const { ctx, status_updates } = make_mock_ctx(cwd);
		await restore_track_status(ctx);

		expect(status_updates).toEqual([{ key: "track", value: undefined }]);
	});

	it("sets status bar to the active track slug", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "active-track", purpose: "test" });

		const branch = [
			{
				type: "custom",
				customType: "track-state",
				data: { action: "set-active", track: "active-track", timestamp: "2026-01-01T00:00:00Z" },
			},
		];
		const { ctx, status_updates } = make_mock_ctx(cwd, branch);
		await restore_track_status(ctx);

		expect(status_updates).toEqual([{ key: "track", value: "🧵 active-track" }]);
	});

	it("shows missing-track warning when track directory is gone", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		// Don't create the track — it's "missing"
		await fs.mkdir(tracks_dir, { recursive: true });
		await fs.writeFile(path.join(tracks_dir, "settings.json"), "{}\n", "utf8");

		const branch = [
			{
				type: "custom",
				customType: "track-state",
				data: { action: "set-active", track: "ghost", timestamp: "2026-01-01T00:00:00Z" },
			},
		];
		const { ctx, status_updates, notifications } = make_mock_ctx(cwd, branch);
		await restore_track_status(ctx);

		expect(status_updates).toEqual([{ key: "track", value: "🧵 missing:ghost" }]);
		expect(notifications).toHaveLength(1);
		expect(notifications[0].level).toBe("warning");
		expect(notifications[0].message).toContain("ghost");
	});
});
