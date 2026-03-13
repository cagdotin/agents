import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let tmp_dir: string;
let repo_dir: string;
let counter = 0;

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "qmd-binding-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(async () => {
	counter += 1;
	repo_dir = path.join(tmp_dir, `repo-${counter}`);
	await mkdir(repo_dir, { recursive: true });
	vi.restoreAllMocks();
	vi.resetModules();
});

describe("collection_key_from_repo_root", () => {
	it("derives a stable path-based key", async () => {
		const module = await import("../../domain/repo-binding.js");
		const key = module.collection_key_from_repo_root("/tmp/repo");
		expect(key.startsWith("p_")).toBe(true);
		expect(key).toBe(module.collection_key_from_repo_root("/tmp/repo"));
	});
});

describe("repo marker read/write", () => {
	it("round-trips .pi/qmd.json", async () => {
		const module = await import("../../domain/repo-binding.js");
		const marker = {
			schema_version: 1 as const,
			repo_root: repo_dir,
			collection_key: module.collection_key_from_repo_root(repo_dir),
			last_indexed_at: "2026-03-13T12:00:00.000Z",
			last_indexed_commit: "abc123",
			created_at: "2026-03-13T12:00:00.000Z",
		};

		await module.write_repo_marker(repo_dir, marker);
		const loaded = await module.read_repo_marker(repo_dir);
		expect(loaded).toEqual(marker);
	});
});
