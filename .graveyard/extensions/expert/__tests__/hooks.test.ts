import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EXPERTISE_PINNED_ENTRY_TYPE } from "../constants.js";
import {
	EXPERTISE_LOADED_MESSAGE_TYPE,
	EXPERTISE_SKIPPED_MESSAGE_TYPE,
	get_pinned_domains,
	register_hooks,
	set_pinned_domains,
} from "../hooks.js";
import { write_expertise } from "../storage.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type EventHandler = (event: any, ctx: any) => Promise<any>;

function create_mock_pi() {
	const handlers = new Map<string, EventHandler[]>();
	const entries: Array<{ type: string; data: any }> = [];

	return {
		handlers,
		entries,
		on(event_name: string, handler: EventHandler) {
			if (!handlers.has(event_name)) handlers.set(event_name, []);
			handlers.get(event_name)!.push(handler);
		},
		appendEntry<T>(type: string, data: T) {
			entries.push({ type, data });
		},
		async trigger(event_name: string, event: any, ctx: any) {
			const fns = handlers.get(event_name) ?? [];
			let result: any;
			for (const fn of fns) {
				result = await fn(event, ctx);
			}
			return result;
		},
	};
}

function create_mock_ctx(cwd: string, options?: { branch_entries?: any[]; context_percent?: number }) {
	const statuses = new Map<string, string | undefined>();
	const notifications: Array<{ message: string; level: string }> = [];

	return {
		cwd,
		statuses,
		notifications,
		sessionManager: {
			getBranch() {
				return options?.branch_entries ?? [];
			},
		},
		getContextUsage() {
			if (options?.context_percent === undefined) return undefined;
			return { percent: options.context_percent };
		},
		ui: {
			setStatus(key: string, value: string | undefined) {
				statuses.set(key, value);
			},
			notify(message: string, level: string) {
				notifications.push({ message, level });
			},
		},
	};
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let tmp_dir: string;
let expertise_dir: string;
let test_counter = 0;

beforeAll(async () => {
	tmp_dir = await mkdtemp(path.join(os.tmpdir(), "expert-hooks-test-"));
});

afterAll(async () => {
	await rm(tmp_dir, { recursive: true, force: true });
});

beforeEach(async () => {
	test_counter += 1;
	const cwd = path.join(tmp_dir, `sub-${test_counter}`);
	expertise_dir = path.join(cwd, ".pi", "expertise");
	await mkdir(expertise_dir, { recursive: true });

	// Clear module-level pinned state between tests
	const pinned = get_pinned_domains();
	pinned.clear();
});

function get_cwd(): string {
	return path.dirname(path.dirname(expertise_dir));
}

// ---------------------------------------------------------------------------
// before_agent_start — no domains
// ---------------------------------------------------------------------------

describe("before_agent_start — no domains", () => {
	it("returns undefined when no domains exist", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// before_agent_start — domain listing
// ---------------------------------------------------------------------------

describe("before_agent_start — domain listing", () => {
	it("injects compact domain listing into system prompt", async () => {
		await write_expertise(
			expertise_dir,
			"database",
			'domain: database\ndescription: "DB layer"\nscope:\n  paths: []\n',
		);
		await write_expertise(expertise_dir, "auth", 'domain: auth\ndescription: "Auth system"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result).toBeDefined();
		expect(result.systemPrompt).toContain("# Domain Expertise");
		expect(result.systemPrompt).toContain("- auth: Auth system");
		expect(result.systemPrompt).toContain("- database: DB layer");
		expect(result.systemPrompt).toContain("Available domains");
		expect(result.systemPrompt.startsWith("base")).toBe(true);
	});

	it("reports domain count in message", async () => {
		await write_expertise(expertise_dir, "one", 'domain: one\ndescription: "One"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "" }, ctx);

		expect(result.message.customType).toBe(EXPERTISE_LOADED_MESSAGE_TYPE);
		expect(result.message.content).toContain("1 expertise domain(s) available");
		expect(result.message.details.domains).toEqual([]);
	});

	it("includes append reminder in injection", async () => {
		await write_expertise(expertise_dir, "test", 'domain: test\ndescription: "T"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "" }, ctx);

		expect(result.systemPrompt).toContain("expertise");
		expect(result.systemPrompt).toContain("append");
	});
});

// ---------------------------------------------------------------------------
// before_agent_start — pinned domains
// ---------------------------------------------------------------------------

describe("before_agent_start — pinned domains", () => {
	it("injects full YAML for pinned domains", async () => {
		const yaml = 'domain: pinned-test\ndescription: "Pinned"\nscope:\n  paths:\n    - src/\ngotchas:\n  - "Careful!"\n';
		await write_expertise(expertise_dir, "pinned-test", yaml);

		const pi = create_mock_pi();
		register_hooks(pi as any);

		// Pin the domain
		set_pinned_domains([{ domain: "pinned-test", description: "Pinned" }], pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result.systemPrompt).toContain('<expertise domain="pinned-test" pinned="true">');
		expect(result.systemPrompt).toContain("Careful!");
		expect(result.message.content).toContain("pinned-test");
		expect(result.message.details.domains).toHaveLength(1);
		expect(result.message.details.domains[0].pinned).toBe(true);
	});

	it("shows 'Other available domains' when some are pinned", async () => {
		await write_expertise(expertise_dir, "pinned", 'domain: pinned\ndescription: "P"\nscope:\n  paths: []\n');
		await write_expertise(expertise_dir, "other", 'domain: other\ndescription: "O"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		set_pinned_domains([{ domain: "pinned", description: "P" }], pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "" }, ctx);

		expect(result.systemPrompt).toContain("Other available domains");
		expect(result.systemPrompt).toContain("- other: O");
		// Pinned domain should NOT appear in the listing
		expect(result.systemPrompt).not.toContain("- pinned: P");
	});

	it("skips pinned domain that no longer exists on disk", async () => {
		await write_expertise(expertise_dir, "existing", 'domain: existing\ndescription: "E"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		// Pin a domain that doesn't exist on disk
		set_pinned_domains([{ domain: "deleted-domain", description: "Gone" }], pi as any);

		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "" }, ctx);

		// Should still inject the listing but no pinned blocks
		expect(result.systemPrompt).toContain("Available domains");
		expect(result.systemPrompt).not.toContain("deleted-domain");
		expect(result.message.details.domains).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// before_agent_start — context threshold
// ---------------------------------------------------------------------------

describe("before_agent_start — context threshold", () => {
	it("skips all injection when context usage exceeds threshold", async () => {
		await write_expertise(expertise_dir, "test", 'domain: test\ndescription: "T"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd(), { context_percent: 95 });
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result.message.customType).toBe(EXPERTISE_SKIPPED_MESSAGE_TYPE);
		expect(result.message.details.usage_percent).toBe(95);
		expect(result.message.details.threshold_percent).toBe(92);
		// Should NOT modify systemPrompt
		expect(result.systemPrompt).toBeUndefined();
	});

	it("injects normally when context usage is below threshold", async () => {
		await write_expertise(expertise_dir, "test", 'domain: test\ndescription: "T"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd(), { context_percent: 50 });
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result.systemPrompt).toContain("# Domain Expertise");
	});

	it("injects normally when context usage is exactly at threshold", async () => {
		await write_expertise(expertise_dir, "test", 'domain: test\ndescription: "T"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		// Threshold is 92, usage is exactly 92 — should skip (>=)
		const ctx = create_mock_ctx(get_cwd(), { context_percent: 92 });
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result.message.customType).toBe(EXPERTISE_SKIPPED_MESSAGE_TYPE);
	});

	it("injects normally when context usage is undefined", async () => {
		await write_expertise(expertise_dir, "test", 'domain: test\ndescription: "T"\nscope:\n  paths: []\n');

		const pi = create_mock_pi();
		register_hooks(pi as any);

		// No context usage info — should not skip
		const ctx = create_mock_ctx(get_cwd());
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result.systemPrompt).toContain("# Domain Expertise");
	});

	it("uses custom threshold from settings", async () => {
		await write_expertise(expertise_dir, "test", 'domain: test\ndescription: "T"\nscope:\n  paths: []\n');
		await writeFile(
			path.join(expertise_dir, "settings.json"),
			JSON.stringify({ max_context_percent_for_any_inject: 80 }),
		);

		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd(), { context_percent: 85 });
		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, ctx);

		expect(result.message.customType).toBe(EXPERTISE_SKIPPED_MESSAGE_TYPE);
		expect(result.message.details.threshold_percent).toBe(80);
	});
});

// ---------------------------------------------------------------------------
// Session lifecycle — rebuild_from_session
// ---------------------------------------------------------------------------

describe("session lifecycle — rebuild pinned state", () => {
	it("rebuilds pinned domains from session branch entries", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const branch_entries = [
			{
				type: "custom",
				customType: EXPERTISE_PINNED_ENTRY_TYPE,
				data: { domains: [{ domain: "db", description: "Database" }] },
			},
		];

		const ctx = create_mock_ctx(get_cwd(), { branch_entries });
		await pi.trigger("session_start", {}, ctx);

		const pinned = get_pinned_domains();
		expect(pinned.size).toBe(1);
		expect(pinned.get("db")).toBe("Database");
	});

	it("last pinned entry wins", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const branch_entries = [
			{
				type: "custom",
				customType: EXPERTISE_PINNED_ENTRY_TYPE,
				data: { domains: [{ domain: "old", description: "Old" }] },
			},
			{
				type: "custom",
				customType: EXPERTISE_PINNED_ENTRY_TYPE,
				data: { domains: [{ domain: "new", description: "New" }] },
			},
		];

		const ctx = create_mock_ctx(get_cwd(), { branch_entries });
		await pi.trigger("session_start", {}, ctx);

		const pinned = get_pinned_domains();
		expect(pinned.size).toBe(1);
		expect(pinned.has("new")).toBe(true);
		expect(pinned.has("old")).toBe(false);
	});

	it("clears pinned state when no entries in branch", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		// First, set some pinned domains
		set_pinned_domains([{ domain: "temp", description: "Temp" }], pi as any);
		expect(get_pinned_domains().size).toBe(1);

		// Then simulate session_start with empty branch
		const ctx = create_mock_ctx(get_cwd(), { branch_entries: [] });
		await pi.trigger("session_start", {}, ctx);

		expect(get_pinned_domains().size).toBe(0);
	});

	it("sets status bar for pinned domains", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const branch_entries = [
			{
				type: "custom",
				customType: EXPERTISE_PINNED_ENTRY_TYPE,
				data: { domains: [{ domain: "auth", description: "Auth" }] },
			},
		];

		const ctx = create_mock_ctx(get_cwd(), { branch_entries });
		await pi.trigger("session_start", {}, ctx);

		expect(ctx.statuses.get("expert")).toContain("📌");
		expect(ctx.statuses.get("expert")).toContain("auth");
	});

	it("clears status bar when no pinned domains", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const ctx = create_mock_ctx(get_cwd(), { branch_entries: [] });
		await pi.trigger("session_start", {}, ctx);

		expect(ctx.statuses.get("expert")).toBeUndefined();
	});

	it("rebuilds on all lifecycle events", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const events = ["session_start", "session_switch", "session_tree", "session_fork", "session_compact"];

		for (const event_name of events) {
			const branch_entries = [
				{
					type: "custom",
					customType: EXPERTISE_PINNED_ENTRY_TYPE,
					data: { domains: [{ domain: `from-${event_name}`, description: event_name }] },
				},
			];

			const ctx = create_mock_ctx(get_cwd(), { branch_entries });
			await pi.trigger(event_name, {}, ctx);

			const pinned = get_pinned_domains();
			expect(pinned.has(`from-${event_name}`)).toBe(true);
		}
	});

	it("ignores non-pinned custom entries", async () => {
		const pi = create_mock_pi();
		register_hooks(pi as any);

		const branch_entries = [
			{ type: "custom", customType: "some-other-type", data: { foo: "bar" } },
			{ type: "message", role: "user" },
		];

		const ctx = create_mock_ctx(get_cwd(), { branch_entries });
		await pi.trigger("session_start", {}, ctx);

		expect(get_pinned_domains().size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// set_pinned_domains / get_pinned_domains
// ---------------------------------------------------------------------------

describe("set_pinned_domains", () => {
	it("persists via appendEntry", () => {
		const pi = create_mock_pi();

		set_pinned_domains([{ domain: "test", description: "Test" }], pi as any);

		expect(pi.entries).toHaveLength(1);
		expect(pi.entries[0].type).toBe(EXPERTISE_PINNED_ENTRY_TYPE);
		expect(pi.entries[0].data.domains).toEqual([{ domain: "test", description: "Test" }]);
	});

	it("replaces previous pinned set", () => {
		const pi = create_mock_pi();

		set_pinned_domains([{ domain: "a", description: "A" }], pi as any);
		set_pinned_domains([{ domain: "b", description: "B" }], pi as any);

		const pinned = get_pinned_domains();
		expect(pinned.size).toBe(1);
		expect(pinned.has("b")).toBe(true);
		expect(pinned.has("a")).toBe(false);
	});

	it("clears pinned when given empty array", () => {
		const pi = create_mock_pi();

		set_pinned_domains([{ domain: "temp", description: "Temp" }], pi as any);
		set_pinned_domains([], pi as any);

		expect(get_pinned_domains().size).toBe(0);
	});
});
