import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	build_todo_path,
	find_todo_path_by_id,
	garbage_collect_todos,
	generate_todo_id,
	get_todos_dir,
	list_todos,
	migrate_todo_filenames,
	read_todo_file,
	read_todo_settings,
	rename_todo_if_needed,
	title_to_slug,
	write_todo_file,
} from "../storage.js";
import type { TodoRecord } from "../types.js";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let tmp_dir: string;
let test_dir: string;
let test_counter = 0;

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "todos-storage-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(() => {
	test_counter += 1;
	test_dir = path.join(tmp_dir, `sub-${test_counter}`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make_todo_record(overrides: Partial<TodoRecord> = {}): TodoRecord {
	return {
		id: "abcd1234",
		title: "Test todo",
		tags: [],
		status: "open",
		created_at: "2026-01-01T00:00:00Z",
		body: "",
		...overrides,
	};
}

async function write_raw_todo(dir: string, filename: string, content: string) {
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, `${filename}.md`), content);
}

// ---------------------------------------------------------------------------
// get_todos_dir
// ---------------------------------------------------------------------------

describe("get_todos_dir", () => {
	it("returns default .pi/todos path", () => {
		const original = process.env.PI_TODO_PATH;
		delete process.env.PI_TODO_PATH;
		const result = get_todos_dir("/projects/app");
		expect(result).toBe(path.resolve("/projects/app", ".pi/todos"));
		if (original !== undefined) process.env.PI_TODO_PATH = original;
	});
});

// ---------------------------------------------------------------------------
// Frontmatter serialization round-trip
// ---------------------------------------------------------------------------

describe("frontmatter serialization", () => {
	it("round-trips write → read", async () => {
		const todo = make_todo_record({
			title: "Fix the bug",
			tags: ["urgent", "backend"],
			status: "open",
		});
		await mkdir(test_dir, { recursive: true });
		const file_path = path.join(test_dir, "fix-the-bug.md");
		await write_todo_file(file_path, todo);
		const result = await read_todo_file(file_path, "abcd1234");

		expect(result.id).toBe("abcd1234");
		expect(result.title).toBe("Fix the bug");
		expect(result.tags).toEqual(["urgent", "backend"]);
		expect(result.status).toBe("open");
	});

	it("handles special characters in title", async () => {
		const todo = make_todo_record({ title: 'Fix: "the" bug #123 [critical]' });
		await mkdir(test_dir, { recursive: true });
		const file_path = path.join(test_dir, "fix-the-bug-123-critical.md");
		await write_todo_file(file_path, todo);
		const result = await read_todo_file(file_path, "abcd1234");
		expect(result.title).toBe('Fix: "the" bug #123 [critical]');
	});

	it("handles empty tags as []", async () => {
		const todo = make_todo_record({ tags: [] });
		await mkdir(test_dir, { recursive: true });
		const file_path = path.join(test_dir, "test-todo.md");
		await write_todo_file(file_path, todo);
		const raw = await readFile(file_path, "utf8");
		expect(raw).toContain("tags: []");
	});

	it("preserves body content", async () => {
		const todo = make_todo_record({ body: "## Details\n\nSome description here.\n\n- Item 1\n- Item 2" });
		await mkdir(test_dir, { recursive: true });
		const file_path = path.join(test_dir, "test-todo.md");
		await write_todo_file(file_path, todo);
		const result = await read_todo_file(file_path, "abcd1234");
		expect(result.body).toContain("## Details");
		expect(result.body).toContain("- Item 1");
	});

	it("handles assigned_to_session", async () => {
		const todo = make_todo_record({ assigned_to_session: "session-abc" });
		await mkdir(test_dir, { recursive: true });
		const file_path = path.join(test_dir, "test-todo.md");
		await write_todo_file(file_path, todo);
		const result = await read_todo_file(file_path, "abcd1234");
		expect(result.assigned_to_session).toBe("session-abc");
	});
});

// ---------------------------------------------------------------------------
// split_front_matter / parse_frontmatter (via read_todo_file)
// ---------------------------------------------------------------------------

describe("split_front_matter", () => {
	it("parses YAML frontmatter", async () => {
		const content = `---
id: test1234
title: "My Todo"
tags: []
status: open
created_at: "2026-01-01T00:00:00Z"
---

Body content here.
`;
		await write_raw_todo(test_dir, "my-todo", content);
		const result = await read_todo_file(path.join(test_dir, "my-todo.md"), "test1234");
		expect(result.title).toBe("My Todo");
		expect(result.body).toContain("Body content here.");
	});

	it("migrates JSON frontmatter", async () => {
		const content = `{"id":"legacy123","title":"Legacy Todo","tags":["old"],"status":"open","created_at":"2025-01-01T00:00:00Z"}

Old body content.
`;
		await write_raw_todo(test_dir, "legacy-todo", content);
		const result = await read_todo_file(path.join(test_dir, "legacy-todo.md"), "legacy123");
		expect(result.title).toBe("Legacy Todo");
		expect(result.tags).toEqual(["old"]);
		expect(result.body).toContain("Old body content.");
	});

	it("migrates legacy JSON frontmatter with mixed primitive types", async () => {
		const content = `{"id":1234,"title":42,"tags":["old",7,true],"status":true,"created_at":"2025-01-01T00:00:00Z"}

Body content.
`;
		await write_raw_todo(test_dir, "legacymix", content);
		const result = await read_todo_file(path.join(test_dir, "legacymix.md"), "legacymix");
		expect(result.id).toBe("legacymix");
		expect(result.title).toBe("");
		expect(result.tags).toEqual(["old", "7", "true"]);
		expect(result.status).toBe("true");
		expect(result.body).toContain("Body content.");
	});

	it("handles no frontmatter — returns empty + full body", async () => {
		const content = "Just some plain text with no frontmatter.";
		await write_raw_todo(test_dir, "nofm1234", content);
		const result = await read_todo_file(path.join(test_dir, "nofm1234.md"), "nofm1234");
		expect(result.title).toBe("");
		expect(result.id).toBe("nofm1234");
	});
});

// ---------------------------------------------------------------------------
// parse_frontmatter — field parsing
// ---------------------------------------------------------------------------

describe("parse_frontmatter fields", () => {
	it("parses all fields correctly", async () => {
		const content = `---
id: aabb1122
title: "Full Featured Todo"
tags:
  - backend
  - urgent
status: in-progress
created_at: "2026-03-01T12:00:00Z"
assigned_to_session: session-xyz
---
`;
		await write_raw_todo(test_dir, "full-featured-todo", content);
		const result = await read_todo_file(path.join(test_dir, "full-featured-todo.md"), "aabb1122");
		expect(result.id).toBe("aabb1122");
		expect(result.title).toBe("Full Featured Todo");
		expect(result.tags).toEqual(["backend", "urgent"]);
		expect(result.status).toBe("in-progress");
		expect(result.assigned_to_session).toBe("session-xyz");
	});

	it("uses defaults for missing fields", async () => {
		const content = `---
id: bare1234
---
`;
		await write_raw_todo(test_dir, "bare-todo", content);
		const result = await read_todo_file(path.join(test_dir, "bare-todo.md"), "bare1234");
		expect(result.title).toBe("");
		expect(result.tags).toEqual([]);
		expect(result.status).toBe("open");
	});

	it("parses inline array (empty)", async () => {
		const content = `---
id: inline12
title: Inline
tags: []
status: open
created_at: "2026-01-01"
---
`;
		await write_raw_todo(test_dir, "inline", content);
		const result = await read_todo_file(path.join(test_dir, "inline.md"), "inline12");
		expect(result.tags).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// generate_todo_id
// ---------------------------------------------------------------------------

describe("generate_todo_id", () => {
	it("returns 8-char hex string", async () => {
		await mkdir(test_dir, { recursive: true });
		const id = await generate_todo_id(test_dir);
		expect(id).toMatch(/^[a-f0-9]{8}$/);
	});

	it("generates unique ids", async () => {
		await mkdir(test_dir, { recursive: true });
		const ids = new Set<string>();
		for (let i = 0; i < 10; i++) {
			ids.add(await generate_todo_id(test_dir));
		}
		expect(ids.size).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// list_todos
// ---------------------------------------------------------------------------

describe("list_todos", () => {
	it("lists multiple todos sorted", async () => {
		const todo1 = make_todo_record({ id: "11111111", title: "First", created_at: "2026-01-01T00:00:00Z" });
		const todo2 = make_todo_record({ id: "22222222", title: "Second", created_at: "2026-01-02T00:00:00Z" });
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "first.md"), todo1);
		await write_todo_file(path.join(test_dir, "second.md"), todo2);

		const result = await list_todos(test_dir);
		expect(result.length).toBe(2);
		// Sorted by created_at
		expect(result[0].id).toBe("11111111");
		expect(result[1].id).toBe("22222222");
	});

	it("returns empty array for nonexistent directory", async () => {
		const result = await list_todos(path.join(tmp_dir, "nonexistent"));
		expect(result).toEqual([]);
	});

	it("ignores non-md files", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), "{}");
		await writeFile(path.join(test_dir, "notes.txt"), "notes");
		const todo = make_todo_record({ id: "aabbccdd", title: "Test todo" });
		await write_todo_file(path.join(test_dir, "test-todo.md"), todo);

		const result = await list_todos(test_dir);
		expect(result.length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// garbage_collect_todos
// ---------------------------------------------------------------------------

describe("garbage_collect_todos", () => {
	it("deletes closed todos older than cutoff", async () => {
		const old_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
		const old_todo = make_todo_record({
			id: "old11111",
			title: "Old closed todo",
			status: "closed",
			created_at: old_date,
		});
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "old-closed-todo.md"), old_todo);

		await garbage_collect_todos(test_dir, { gc: true, gc_days: 7 });

		const result = await list_todos(test_dir);
		expect(result.length).toBe(0);
	});

	it("preserves open todos", async () => {
		const old_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		const open_todo = make_todo_record({
			id: "open1111",
			title: "Old open todo",
			status: "open",
			created_at: old_date,
		});
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "old-open-todo.md"), open_todo);

		await garbage_collect_todos(test_dir, { gc: true, gc_days: 7 });

		const result = await list_todos(test_dir);
		expect(result.length).toBe(1);
	});

	it("no-op when gc is disabled", async () => {
		const old_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		const closed_todo = make_todo_record({
			id: "keep1111",
			title: "Keep this todo",
			status: "closed",
			created_at: old_date,
		});
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "keep-this-todo.md"), closed_todo);

		await garbage_collect_todos(test_dir, { gc: false, gc_days: 7 });

		const result = await list_todos(test_dir);
		expect(result.length).toBe(1);
	});

	it("preserves recently closed todos", async () => {
		const recent_todo = make_todo_record({
			id: "new11111",
			title: "Recently closed todo",
			status: "closed",
			created_at: new Date().toISOString(), // just now
		});
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "recently-closed-todo.md"), recent_todo);

		await garbage_collect_todos(test_dir, { gc: true, gc_days: 7 });

		const result = await list_todos(test_dir);
		expect(result.length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// read_todo_settings
// ---------------------------------------------------------------------------

describe("read_todo_settings", () => {
	it("returns defaults when file missing", async () => {
		await mkdir(test_dir, { recursive: true });
		const settings = await read_todo_settings(test_dir);
		expect(settings.gc).toBe(true);
		expect(settings.gc_days).toBe(7);
	});

	it("parses valid JSON settings", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), JSON.stringify({ gc: false, gc_days: 14 }));
		const settings = await read_todo_settings(test_dir);
		expect(settings.gc).toBe(false);
		expect(settings.gc_days).toBe(14);
	});

	it("returns defaults for invalid JSON", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), "invalid json");
		const settings = await read_todo_settings(test_dir);
		expect(settings.gc).toBe(true);
		expect(settings.gc_days).toBe(7);
	});

	it("ignores invalid field types while preserving valid settings", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "settings.json"), JSON.stringify({ gc: false, gc_days: "soon" }));
		const settings = await read_todo_settings(test_dir);
		expect(settings.gc).toBe(false);
		expect(settings.gc_days).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// title_to_slug
// ---------------------------------------------------------------------------

describe("title_to_slug", () => {
	it("converts title to kebab-case", () => {
		expect(title_to_slug("Fix the bug")).toBe("fix-the-bug");
	});

	it("strips special characters", () => {
		expect(title_to_slug('Fix: "the" bug #123 [critical]')).toBe("fix-the-bug-123-critical");
	});

	it("collapses multiple hyphens", () => {
		expect(title_to_slug("Fix -- the -- bug")).toBe("fix-the-bug");
	});

	it("trims leading/trailing hyphens", () => {
		expect(title_to_slug(" - Fix the bug - ")).toBe("fix-the-bug");
	});

	it("returns 'untitled' for empty string", () => {
		expect(title_to_slug("")).toBe("untitled");
		expect(title_to_slug("   ")).toBe("untitled");
	});

	it("returns 'untitled' for only-special-chars title", () => {
		expect(title_to_slug("!@#$%")).toBe("untitled");
	});

	it("truncates to 80 characters", () => {
		const long_title = "a".repeat(100);
		expect(title_to_slug(long_title).length).toBeLessThanOrEqual(80);
	});
});

// ---------------------------------------------------------------------------
// build_todo_path
// ---------------------------------------------------------------------------

describe("build_todo_path", () => {
	it("creates path from title slug", async () => {
		await mkdir(test_dir, { recursive: true });
		const result = build_todo_path(test_dir, "Fix the bug");
		expect(result).toBe(path.join(test_dir, "fix-the-bug.md"));
	});

	it("handles slug collisions with numeric suffix", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "fix-the-bug.md"), "existing");
		const result = build_todo_path(test_dir, "Fix the bug");
		expect(result).toBe(path.join(test_dir, "fix-the-bug-2.md"));
	});

	it("increments suffix for multiple collisions", async () => {
		await mkdir(test_dir, { recursive: true });
		await writeFile(path.join(test_dir, "fix-the-bug.md"), "existing");
		await writeFile(path.join(test_dir, "fix-the-bug-2.md"), "existing");
		const result = build_todo_path(test_dir, "Fix the bug");
		expect(result).toBe(path.join(test_dir, "fix-the-bug-3.md"));
	});
});

// ---------------------------------------------------------------------------
// find_todo_path_by_id
// ---------------------------------------------------------------------------

describe("find_todo_path_by_id", () => {
	it("finds todo by frontmatter id", async () => {
		const todo = make_todo_record({ id: "aabb1122", title: "My Todo" });
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "my-todo.md"), todo);

		const result = await find_todo_path_by_id(test_dir, "aabb1122");
		expect(result).toBe(path.join(test_dir, "my-todo.md"));
	});

	it("returns null for nonexistent id", async () => {
		await mkdir(test_dir, { recursive: true });
		const result = await find_todo_path_by_id(test_dir, "deadbeef");
		expect(result).toBeNull();
	});

	it("returns null for nonexistent directory", async () => {
		const result = await find_todo_path_by_id(path.join(tmp_dir, "nope"), "aabb1122");
		expect(result).toBeNull();
	});

	it("finds legacy hex-named files too", async () => {
		const todo = make_todo_record({ id: "aabb1122", title: "Legacy" });
		await mkdir(test_dir, { recursive: true });
		// Simulate old-style hex-id filename
		await write_todo_file(path.join(test_dir, "aabb1122.md"), todo);

		const result = await find_todo_path_by_id(test_dir, "aabb1122");
		expect(result).toBe(path.join(test_dir, "aabb1122.md"));
	});
});

// ---------------------------------------------------------------------------
// rename_todo_if_needed
// ---------------------------------------------------------------------------

describe("rename_todo_if_needed", () => {
	it("renames file to match new title", async () => {
		const todo = make_todo_record({ id: "aabb1122", title: "Old title" });
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "old-title.md"), todo);

		const new_path = await rename_todo_if_needed(test_dir, path.join(test_dir, "old-title.md"), "New title");
		expect(new_path).toBe(path.join(test_dir, "new-title.md"));
		expect(existsSync(path.join(test_dir, "new-title.md"))).toBe(true);
		expect(existsSync(path.join(test_dir, "old-title.md"))).toBe(false);
	});

	it("returns same path if slug unchanged", async () => {
		const todo = make_todo_record({ id: "aabb1122", title: "Same title" });
		await mkdir(test_dir, { recursive: true });
		await write_todo_file(path.join(test_dir, "same-title.md"), todo);

		const new_path = await rename_todo_if_needed(test_dir, path.join(test_dir, "same-title.md"), "Same title");
		expect(new_path).toBe(path.join(test_dir, "same-title.md"));
	});

	it("handles collision during rename", async () => {
		await mkdir(test_dir, { recursive: true });
		const todo1 = make_todo_record({ id: "11111111", title: "Target" });
		const todo2 = make_todo_record({ id: "22222222", title: "Source" });
		await write_todo_file(path.join(test_dir, "target.md"), todo1);
		await write_todo_file(path.join(test_dir, "source.md"), todo2);

		const new_path = await rename_todo_if_needed(test_dir, path.join(test_dir, "source.md"), "Target");
		expect(new_path).toBe(path.join(test_dir, "target-2.md"));
	});
});

// ---------------------------------------------------------------------------
// migrate_todo_filenames
// ---------------------------------------------------------------------------

describe("migrate_todo_filenames", () => {
	it("renames hex-id files to title-based names", async () => {
		await mkdir(test_dir, { recursive: true });
		const todo = make_todo_record({ id: "aabb1122", title: "My Great Todo" });
		// Write with old hex-id naming
		await write_todo_file(path.join(test_dir, "aabb1122.md"), todo);

		await migrate_todo_filenames(test_dir);

		expect(existsSync(path.join(test_dir, "aabb1122.md"))).toBe(false);
		expect(existsSync(path.join(test_dir, "my-great-todo.md"))).toBe(true);
	});

	it("skips files that are already title-based", async () => {
		await mkdir(test_dir, { recursive: true });
		const todo = make_todo_record({ id: "aabb1122", title: "Already Named" });
		await write_todo_file(path.join(test_dir, "already-named.md"), todo);

		await migrate_todo_filenames(test_dir);

		expect(existsSync(path.join(test_dir, "already-named.md"))).toBe(true);
	});

	it("skips todos with empty titles", async () => {
		await mkdir(test_dir, { recursive: true });
		const todo = make_todo_record({ id: "aabb1122", title: "" });
		await write_todo_file(path.join(test_dir, "aabb1122.md"), todo);

		await migrate_todo_filenames(test_dir);

		// File stays since title is empty
		expect(existsSync(path.join(test_dir, "aabb1122.md"))).toBe(true);
	});

	it("handles nonexistent directory gracefully", async () => {
		await expect(migrate_todo_filenames(path.join(tmp_dir, "nope"))).resolves.toBeUndefined();
	});
});
