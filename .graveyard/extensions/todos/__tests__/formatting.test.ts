import { describe, expect, it } from "vitest";
import {
	format_assignment_suffix,
	format_todo_heading,
	format_todo_list,
	serialize_todo_for_agent,
	serialize_todo_list_for_agent,
} from "../formatting.js";
import type { TodoFrontMatter, TodoRecord } from "../types.js";

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
// format_assignment_suffix
// ---------------------------------------------------------------------------

describe("format_assignment_suffix", () => {
	it("returns empty for unassigned", () => {
		expect(format_assignment_suffix(make_todo())).toBe("");
	});

	it("returns suffix for assigned", () => {
		const result = format_assignment_suffix(make_todo({ assigned_to_session: "session-1" }));
		expect(result).toContain("assigned: session-1");
	});
});

// ---------------------------------------------------------------------------
// format_todo_heading
// ---------------------------------------------------------------------------

describe("format_todo_heading", () => {
	it("includes id and title", () => {
		const heading = format_todo_heading(make_todo({ title: "Fix the bug" }));
		expect(heading).toContain("TODO-abcd1234");
		expect(heading).toContain("Fix the bug");
	});

	it("includes tags when present", () => {
		const heading = format_todo_heading(make_todo({ tags: ["urgent", "backend"] }));
		expect(heading).toContain("[urgent, backend]");
	});

	it("omits tags when empty", () => {
		const heading = format_todo_heading(make_todo({ tags: [] }));
		expect(heading).not.toContain("[");
	});

	it("shows (untitled) for missing title", () => {
		const heading = format_todo_heading(make_todo({ title: "" }));
		expect(heading).toContain("(untitled)");
	});
});

// ---------------------------------------------------------------------------
// format_todo_list
// ---------------------------------------------------------------------------

describe("format_todo_list", () => {
	it("returns 'No todos.' for empty list", () => {
		expect(format_todo_list([])).toBe("No todos.");
	});

	it("groups by assignment status", () => {
		const todos = [
			make_todo({ id: "11111111", status: "open", assigned_to_session: "s1" }),
			make_todo({ id: "22222222", status: "open" }),
			make_todo({ id: "33333333", status: "closed" }),
		];
		const result = format_todo_list(todos);
		expect(result).toContain("Assigned todos (1)");
		expect(result).toContain("Open todos (1)");
		expect(result).toContain("Closed todos (1)");
	});

	it("shows 'none' for empty sections", () => {
		const todos = [make_todo({ id: "11111111", status: "open" })];
		const result = format_todo_list(todos);
		expect(result).toContain("none");
	});
});

// ---------------------------------------------------------------------------
// serialize_todo_for_agent
// ---------------------------------------------------------------------------

describe("serialize_todo_for_agent", () => {
	it("serializes with TODO- prefix on id", () => {
		const todo: TodoRecord = { ...make_todo(), body: "Details here" };
		const result = JSON.parse(serialize_todo_for_agent(todo));
		expect(result.id).toBe("TODO-abcd1234");
		expect(result.body).toBe("Details here");
	});
});

// ---------------------------------------------------------------------------
// serialize_todo_list_for_agent
// ---------------------------------------------------------------------------

describe("serialize_todo_list_for_agent", () => {
	it("groups into assigned/open/closed", () => {
		const todos = [
			make_todo({ id: "11111111", status: "open", assigned_to_session: "s1" }),
			make_todo({ id: "22222222", status: "open" }),
			make_todo({ id: "33333333", status: "closed" }),
		];
		const result = JSON.parse(serialize_todo_list_for_agent(todos));
		expect(result.assigned.length).toBe(1);
		expect(result.open.length).toBe(1);
		expect(result.closed.length).toBe(1);
		// IDs should have TODO- prefix
		expect(result.assigned[0].id).toBe("TODO-11111111");
	});
});
