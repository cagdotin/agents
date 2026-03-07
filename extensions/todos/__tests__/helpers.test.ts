import { describe, expect, it } from "vitest";
import {
	build_refine_prompt,
	build_todo_search_text,
	filter_todos,
	format_todo_id,
	is_todo_closed,
	normalize_todo_id,
	sort_todos,
	split_todos_by_assignment,
	validate_todo_id,
} from "../helpers.js";
import type { TodoFrontMatter } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make_todo(overrides: Partial<TodoFrontMatter> = {}): TodoFrontMatter {
	return {
		id: "abcd1234",
		title: "Test todo",
		tags: [],
		status: "open",
		created_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// format_todo_id
// ---------------------------------------------------------------------------

describe("format_todo_id", () => {
	it("adds TODO- prefix", () => {
		expect(format_todo_id("abcd1234")).toBe("TODO-abcd1234");
	});
});

// ---------------------------------------------------------------------------
// normalize_todo_id
// ---------------------------------------------------------------------------

describe("normalize_todo_id", () => {
	it("strips TODO- prefix", () => {
		expect(normalize_todo_id("TODO-abcd1234")).toBe("abcd1234");
	});

	it("strips # prefix", () => {
		expect(normalize_todo_id("#TODO-abcd1234")).toBe("abcd1234");
	});

	it("handles bare id", () => {
		expect(normalize_todo_id("abcd1234")).toBe("abcd1234");
	});

	it("is case insensitive on prefix", () => {
		expect(normalize_todo_id("todo-abcd1234")).toBe("abcd1234");
	});

	it("trims whitespace", () => {
		expect(normalize_todo_id("  TODO-abcd1234  ")).toBe("abcd1234");
	});
});

// ---------------------------------------------------------------------------
// validate_todo_id
// ---------------------------------------------------------------------------

describe("validate_todo_id", () => {
	it("accepts valid 8-char hex IDs", () => {
		const result = validate_todo_id("abcd1234");
		expect(result).toEqual({ id: "abcd1234" });
	});

	it("accepts with TODO- prefix", () => {
		const result = validate_todo_id("TODO-ABCD1234");
		expect(result).toEqual({ id: "abcd1234" });
	});

	it("rejects non-hex characters", () => {
		const result = validate_todo_id("xyzw1234");
		expect("error" in result).toBe(true);
	});

	it("rejects wrong length", () => {
		const result = validate_todo_id("abc123");
		expect("error" in result).toBe(true);
	});

	it("rejects empty string", () => {
		const result = validate_todo_id("");
		expect("error" in result).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// is_todo_closed
// ---------------------------------------------------------------------------

describe("is_todo_closed", () => {
	it("'closed' returns true", () => {
		expect(is_todo_closed("closed")).toBe(true);
	});

	it("'done' returns true", () => {
		expect(is_todo_closed("done")).toBe(true);
	});

	it("'open' returns false", () => {
		expect(is_todo_closed("open")).toBe(false);
	});

	it("case insensitive", () => {
		expect(is_todo_closed("CLOSED")).toBe(true);
		expect(is_todo_closed("Done")).toBe(true);
	});

	it("'in-progress' returns false", () => {
		expect(is_todo_closed("in-progress")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// sort_todos
// ---------------------------------------------------------------------------

describe("sort_todos", () => {
	it("puts closed after open", () => {
		const todos = [make_todo({ id: "11111111", status: "closed" }), make_todo({ id: "22222222", status: "open" })];
		const sorted = sort_todos(todos);
		expect(sorted[0].status).toBe("open");
		expect(sorted[1].status).toBe("closed");
	});

	it("puts assigned before unassigned within open", () => {
		const todos = [
			make_todo({ id: "11111111", status: "open" }),
			make_todo({ id: "22222222", status: "open", assigned_to_session: "session-1" }),
		];
		const sorted = sort_todos(todos);
		expect(sorted[0].assigned_to_session).toBe("session-1");
	});

	it("sorts by created_at as tiebreak", () => {
		const todos = [
			make_todo({ id: "11111111", created_at: "2026-01-03T00:00:00Z" }),
			make_todo({ id: "22222222", created_at: "2026-01-01T00:00:00Z" }),
			make_todo({ id: "33333333", created_at: "2026-01-02T00:00:00Z" }),
		];
		const sorted = sort_todos(todos);
		expect(sorted[0].created_at).toBe("2026-01-01T00:00:00Z");
		expect(sorted[1].created_at).toBe("2026-01-02T00:00:00Z");
		expect(sorted[2].created_at).toBe("2026-01-03T00:00:00Z");
	});
});

// ---------------------------------------------------------------------------
// filter_todos
// ---------------------------------------------------------------------------

describe("filter_todos", () => {
	const todos = [
		make_todo({ id: "11111111", title: "Fix database bug", tags: ["backend"], status: "open" }),
		make_todo({ id: "22222222", title: "Update UI styles", tags: ["frontend"], status: "open" }),
		make_todo({ id: "33333333", title: "Deploy to staging", tags: ["devops"], status: "closed" }),
	];

	it("empty query returns all", () => {
		expect(filter_todos(todos, "")).toEqual(todos);
		expect(filter_todos(todos, "   ")).toEqual(todos);
	});

	it("single token filters", () => {
		const result = filter_todos(todos, "database");
		expect(result.length).toBe(1);
		expect(result[0].id).toBe("11111111");
	});

	it("multi-token AND filtering", () => {
		const result = filter_todos(todos, "fix backend");
		expect(result.length).toBe(1);
		expect(result[0].id).toBe("11111111");
	});

	it("no match returns empty", () => {
		const result = filter_todos(todos, "nonexistent");
		expect(result.length).toBe(0);
	});

	it("closed todos sorted after open in results", () => {
		// Make a query that matches both open and closed
		const mixed = [
			make_todo({ id: "11111111", title: "staging task", status: "open" }),
			make_todo({ id: "22222222", title: "staging deploy", status: "closed" }),
		];
		const result = filter_todos(mixed, "staging");
		expect(result[0].status).toBe("open");
		expect(result[1].status).toBe("closed");
	});
});

// ---------------------------------------------------------------------------
// split_todos_by_assignment
// ---------------------------------------------------------------------------

describe("split_todos_by_assignment", () => {
	it("correctly buckets todos", () => {
		const todos = [
			make_todo({ id: "11111111", status: "open", assigned_to_session: "session-1" }),
			make_todo({ id: "22222222", status: "open" }),
			make_todo({ id: "33333333", status: "closed" }),
			make_todo({ id: "44444444", status: "done" }),
		];
		const { assigned_todos, open_todos, closed_todos } = split_todos_by_assignment(todos);
		expect(assigned_todos.length).toBe(1);
		expect(assigned_todos[0].id).toBe("11111111");
		expect(open_todos.length).toBe(1);
		expect(open_todos[0].id).toBe("22222222");
		expect(closed_todos.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// build_todo_search_text
// ---------------------------------------------------------------------------

describe("build_todo_search_text", () => {
	it("includes id, title, tags, and status", () => {
		const todo = make_todo({ id: "abcd1234", title: "Fix bug", tags: ["urgent"], status: "open" });
		const text = build_todo_search_text(todo);
		expect(text).toContain("TODO-abcd1234");
		expect(text).toContain("abcd1234");
		expect(text).toContain("Fix bug");
		expect(text).toContain("urgent");
		expect(text).toContain("open");
	});

	it("includes assignment when present", () => {
		const todo = make_todo({ assigned_to_session: "session-abc" });
		const text = build_todo_search_text(todo);
		expect(text).toContain("assigned:session-abc");
	});
});

// ---------------------------------------------------------------------------
// build_refine_prompt
// ---------------------------------------------------------------------------

describe("build_refine_prompt", () => {
	it("interpolates id and title", () => {
		const result = build_refine_prompt("abcd1234", "Fix the login bug");
		expect(result).toContain("TODO-abcd1234");
		expect(result).toContain('"Fix the login bug"');
	});
});
