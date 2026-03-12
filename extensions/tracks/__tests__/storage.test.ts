import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	clear_active_track,
	create_track_workspace,
	ensure_track_settings_file,
	get_active_track,
	get_track_dir,
	get_tracks_dir,
	increment_track_session_count,
	list_tracks,
	list_tracks_sync,
	normalize_track_slug,
	parse_track_metadata,
	read_track_metadata,
	read_track_record,
	read_track_settings,
	serialize_track_metadata,
	set_active_track,
	write_track_metadata,
} from "../storage.js";

const temp_dirs: string[] = [];

async function create_temp_cwd(): Promise<string> {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "tracks-storage-"));
	temp_dirs.push(cwd);
	return cwd;
}

afterEach(async () => {
	await Promise.all(temp_dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("tracks storage", () => {
	it("normalizes track names into slugs", () => {
		expect(normalize_track_slug(" Docs Refresh ")).toBe("docs-refresh");
		expect(normalize_track_slug("@Fix: CI / Hooks")).toBe("fix-ci-hooks");
	});

	it("rejects empty track names after normalization", () => {
		expect(() => normalize_track_slug("")).toThrow("Track name is required");
		expect(() => normalize_track_slug("@@@")).toThrow("Track name is required");
		expect(() => normalize_track_slug("---")).toThrow("Track name is required");
	});

	it("creates a canonical workspace without partially overwriting existing tracks", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "Demo Track",
			purpose: "Validate track generation",
			related_paths: ["docs/spec.md"],
		});

		expect(track.slug).toBe("demo-track");
		expect(await fs.readFile(path.join(track.dir, "AGENTS.md"), "utf8")).toContain("Validate track generation");
		expect(await fs.stat(path.join(track.dir, "notes"))).toBeTruthy();
		expect(await fs.stat(path.join(track.dir, "artifacts"))).toBeTruthy();

		await expect(
			create_track_workspace({
				tracks_dir,
				name: "Demo Track",
				purpose: "Duplicate",
			}),
		).rejects.toThrow("already exists");
	});

	it("persists the active track binding in settings.json", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({
			tracks_dir,
			name: "Demo Track",
			purpose: "Validate settings persistence",
		});

		await set_active_track(tracks_dir, "demo-track");

		expect(await get_active_track(tracks_dir)).toBe("demo-track");
		expect(await read_track_settings(tracks_dir)).toEqual({ active_track: "demo-track" });
	});

	it("clears the active track binding", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "temp", purpose: "testing" });
		await set_active_track(tracks_dir, "temp");
		expect(await get_active_track(tracks_dir)).toBe("temp");

		await clear_active_track(tracks_dir);
		expect(await get_active_track(tracks_dir)).toBeUndefined();
	});

	it("maps malformed metadata to an actionable error", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({
			tracks_dir,
			name: "Broken Track",
			purpose: "Break the metadata parser",
		});

		const track_dir = get_track_dir(tracks_dir, "broken-track");
		await fs.writeFile(path.join(track_dir, "track.yaml"), "name: broken-track\npurpose: \nstatus: active\n", "utf8");

		await expect(read_track_metadata(track_dir)).rejects.toThrow("Track metadata is invalid");
	});

	it("writes metadata round-trips that keep summary_version and related paths", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "Round Trip",
			purpose: "Verify metadata round-trips",
			related_paths: ["src/index.ts", "docs/notes.md"],
		});

		const metadata = await read_track_metadata(track.dir);
		await write_track_metadata(track.dir, {
			...metadata,
			session_count: 3,
		});

		const reread = await read_track_metadata(track.dir);
		expect(reread.related_paths).toEqual(["src/index.ts", "docs/notes.md"]);
		expect(reread.summary_version).toBe(1);
		expect(reread.session_count).toBe(3);
	});

	it("reads track records and throws actionable errors for missing tracks", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "exists", purpose: "test" });

		const record = await read_track_record(tracks_dir, "exists");
		expect(record.slug).toBe("exists");
		expect(record.metadata.purpose).toBe("test");

		await expect(read_track_record(tracks_dir, "ghost")).rejects.toThrow("not found");
	});

	it("increments session count atomically", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({ tracks_dir, name: "counter", purpose: "test" });

		expect(track.metadata.session_count).toBe(0);

		const after_first = await increment_track_session_count(track.dir);
		expect(after_first.session_count).toBe(1);

		const after_second = await increment_track_session_count(track.dir);
		expect(after_second.session_count).toBe(2);
	});

	it("ensures settings file is created only when missing", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);

		await ensure_track_settings_file(tracks_dir);
		const settings = await read_track_settings(tracks_dir);
		expect(settings).toEqual({});

		// Should not overwrite existing content
		await set_active_track(tracks_dir, "my-track");
		await ensure_track_settings_file(tracks_dir);
		expect(await get_active_track(tracks_dir)).toBe("my-track");
	});
});

describe("YAML metadata parsing", () => {
	it("round-trips special characters in purpose and name", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "special-chars",
			purpose: 'Fix the "broken" pipeline: step #3 [critical]',
		});

		const reread = await read_track_metadata(track.dir);
		expect(reread.purpose).toBe('Fix the "broken" pipeline: step #3 [critical]');
	});

	it("round-trips paths with colons, brackets, and quotes", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		const track = await create_track_workspace({
			tracks_dir,
			name: "path-edge",
			purpose: "test paths",
			related_paths: ["src/[slug]/page.tsx", "docs/notes: final.md", 'config/"dev".yaml'],
		});

		const reread = await read_track_metadata(track.dir);
		expect(reread.related_paths).toEqual(["src/[slug]/page.tsx", "docs/notes: final.md", 'config/"dev".yaml']);
	});

	it("handles empty related_paths array", () => {
		const yaml = [
			"name: minimal",
			'purpose: "test"',
			"status: active",
			'created_at: "2026-01-01T00:00:00Z"',
			'updated_at: "2026-01-01T00:00:00Z"',
			'last_synced_at: "2026-01-01T00:00:00Z"',
			"related_paths: []",
		].join("\n");

		const metadata = parse_track_metadata(yaml, "/tmp/test");
		expect(metadata.related_paths).toEqual([]);
	});

	it("parses numeric fields correctly", () => {
		const yaml = [
			"name: numeric",
			'purpose: "test numbers"',
			"status: active",
			'created_at: "2026-01-01T00:00:00Z"',
			'updated_at: "2026-01-01T00:00:00Z"',
			'last_synced_at: "2026-01-01T00:00:00Z"',
			"session_count: 42",
			"summary_version: 3",
			"related_paths: []",
		].join("\n");

		const metadata = parse_track_metadata(yaml, "/tmp/test");
		expect(metadata.session_count).toBe(42);
		expect(metadata.summary_version).toBe(3);
	});

	it("rejects metadata missing required fields with actionable messages", () => {
		const yaml = "name: broken\nstatus: active\n";
		expect(() => parse_track_metadata(yaml, "/tmp/test")).toThrow("Track metadata is invalid");
		expect(() => parse_track_metadata(yaml, "/tmp/test")).toThrow("track.yaml");
	});

	it("handles optional fields gracefully", () => {
		const yaml = [
			"name: optional-test",
			'purpose: "test optionals"',
			"status: closed",
			'created_at: "2026-01-01T00:00:00Z"',
			'updated_at: "2026-01-01T00:00:00Z"',
			'last_synced_at: "2026-01-01T00:00:00Z"',
			'closed_at: "2026-06-01T12:00:00Z"',
			"related_paths: []",
		].join("\n");

		const metadata = parse_track_metadata(yaml, "/tmp/test");
		expect(metadata.closed_at).toBe("2026-06-01T12:00:00Z");
		expect(metadata.session_count).toBeUndefined();
		expect(metadata.summary_version).toBeUndefined();
	});

	it("serializes and re-parses metadata identically", async () => {
		const original = {
			name: "roundtrip",
			purpose: 'Values with "quotes" and colons: yes',
			status: "active" as const,
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-01T00:00:00Z",
			last_synced_at: "2026-01-01T00:00:00Z",
			related_paths: ["path/one", "path/two: special"],
			session_count: 5,
			summary_version: 1,
		};

		const serialized = serialize_track_metadata(original);
		const parsed = parse_track_metadata(serialized, "/tmp/test");
		expect(parsed.name).toBe(original.name);
		expect(parsed.purpose).toBe(original.purpose);
		expect(parsed.related_paths).toEqual(original.related_paths);
		expect(parsed.session_count).toBe(original.session_count);
	});

	it("skips blank lines and comments in YAML", () => {
		const yaml = [
			"# This is a comment",
			"name: commented",
			"",
			'purpose: "test"',
			"# Another comment",
			"status: active",
			'created_at: "2026-01-01T00:00:00Z"',
			'updated_at: "2026-01-01T00:00:00Z"',
			'last_synced_at: "2026-01-01T00:00:00Z"',
			"related_paths: []",
		].join("\n");

		const metadata = parse_track_metadata(yaml, "/tmp/test");
		expect(metadata.name).toBe("commented");
	});
});

describe("list_tracks", () => {
	it("lists tracks and marks the active one", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "alpha", purpose: "first" });
		await create_track_workspace({ tracks_dir, name: "beta", purpose: "second" });
		await set_active_track(tracks_dir, "beta");

		const tracks = await list_tracks(tracks_dir);
		expect(tracks).toHaveLength(2);
		expect(tracks[0].slug).toBe("alpha");
		expect(tracks[0].is_active).toBe(false);
		expect(tracks[1].slug).toBe("beta");
		expect(tracks[1].is_active).toBe(true);
	});

	it("skips non-directory entries and malformed tracks", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "good", purpose: "works" });

		// Create a non-directory file in tracks_dir
		await fs.writeFile(path.join(tracks_dir, "stray-file.txt"), "not a track", "utf8");

		// Create a directory without valid metadata
		const bad_dir = path.join(tracks_dir, "bad-track");
		await fs.mkdir(bad_dir, { recursive: true });
		await fs.writeFile(path.join(bad_dir, "track.yaml"), "garbage: yes\n", "utf8");

		const tracks = await list_tracks(tracks_dir);
		expect(tracks).toHaveLength(1);
		expect(tracks[0].slug).toBe("good");
	});

	it("returns empty list for non-existent tracks dir (sync)", () => {
		const tracks = list_tracks_sync(`/tmp/nonexistent-tracks-dir-${Date.now()}`);
		expect(tracks).toEqual([]);
	});

	it("lists tracks synchronously with active track binding", async () => {
		const cwd = await create_temp_cwd();
		const tracks_dir = get_tracks_dir(cwd);
		await create_track_workspace({ tracks_dir, name: "sync-test", purpose: "sync listing" });
		await set_active_track(tracks_dir, "sync-test");

		const tracks = list_tracks_sync(tracks_dir);
		expect(tracks).toHaveLength(1);
		expect(tracks[0].slug).toBe("sync-test");
		expect(tracks[0].is_active).toBe(true);
	});
});
