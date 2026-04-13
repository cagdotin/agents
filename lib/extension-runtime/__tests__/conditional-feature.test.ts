import { __testing__, register_conditional_feature } from "../conditional-feature.js";

type Handler = (event: any, ctx: any) => Promise<any> | any;

function create_pi_stub() {
	const handlers = new Map<string, Handler[]>();

	return {
		handlers,
		on(event: string, handler: Handler) {
			const existing = handlers.get(event) ?? [];
			existing.push(handler);
			handlers.set(event, existing);
		},
		async trigger(event: string, payload: any, ctx: any) {
			const registered = handlers.get(event) ?? [];
			const results = [];
			for (const handler of registered) {
				results.push(await handler(payload, ctx));
			}
			return results;
		},
	};
}

describe("conditional feature helper", () => {
	test("normalizes and deduplicates resource paths", () => {
		expect(__testing__.normalize_paths([" /a ", "/a", "", " /b "])).toEqual(["/a", "/b"]);
		expect(__testing__.normalize_paths([])).toBeUndefined();
	});

	test("uses cached startup detection for activation and resource discovery", async () => {
		const pi = create_pi_stub();
		const detect = vi.fn(async () => ({ indexed: true }));
		const activate = vi.fn();

		const handle = register_conditional_feature(pi as any, {
			feature_name: "qmd",
			detect,
			should_activate: (state) => state.indexed,
			activate,
			skill_paths: (state) => (state.indexed ? ["/tmp/qmd/SKILL.md"] : []),
		});

		const ctx = { cwd: "/repo" };
		await pi.trigger("session_start", { type: "session_start" }, ctx);
		const results = await pi.trigger(
			"resources_discover",
			{ type: "resources_discover", cwd: "/repo", reason: "startup" },
			ctx,
		);

		expect(detect).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledWith(
			expect.objectContaining({
				cwd: "/repo",
				reason: "startup",
				state: { indexed: true },
			}),
		);
		expect(results[0]).toEqual({ skillPaths: ["/tmp/qmd/SKILL.md"], promptPaths: undefined });
		expect(handle.is_active()).toBe(true);
		expect(handle.has_detected()).toBe(true);
	});

	test("does not expose resources when active but inclusion predicate returns false", async () => {
		const pi = create_pi_stub();

		register_conditional_feature(pi as any, {
			feature_name: "qmd",
			detect: async () => ({ can_init: true, indexed: false }),
			should_activate: (state) => state.can_init,
			should_include_skills: (state) => state.indexed,
			skill_paths: ["/tmp/qmd/SKILL.md"],
		});

		const results = await pi.trigger(
			"resources_discover",
			{ type: "resources_discover", cwd: "/repo", reason: "startup" },
			{ cwd: "/repo" },
		);

		expect(results[0]).toBeUndefined();
	});

	test("fails closed and reports detection errors", async () => {
		const pi = create_pi_stub();
		const on_detection_error = vi.fn();

		const handle = register_conditional_feature(pi as any, {
			feature_name: "broken",
			detect: async () => {
				throw new Error("boom");
			},
			should_activate: () => true,
			on_detection_error,
			skill_paths: ["/tmp/broken/SKILL.md"],
		});

		const ctx = { cwd: "/repo" };
		await pi.trigger("session_start", { type: "session_start" }, ctx);
		const results = await pi.trigger(
			"resources_discover",
			{ type: "resources_discover", cwd: "/repo", reason: "startup" },
			ctx,
		);

		expect(on_detection_error).toHaveBeenCalledTimes(1);
		expect(on_detection_error).toHaveBeenCalledWith(
			expect.objectContaining({
				feature_name: "broken",
				cwd: "/repo",
				reason: "startup",
				error: expect.any(Error),
			}),
		);
		expect(results[0]).toBeUndefined();
		expect(handle.get_snapshot()).toEqual({
			state: undefined,
			active: false,
			detected: false,
			cwd: "/repo",
			reason: "startup",
		});
	});

	test("injects cached system prompt hints and sends activation message only once", async () => {
		const pi = create_pi_stub();

		register_conditional_feature(pi as any, {
			feature_name: "cmux",
			detect: async () => ({ available: true }),
			should_activate: (state) => state.available,
			system_prompt_hint: "You are running inside cmux.",
			activation_message: {
				customType: "cmux-detected",
				content: "cmux detected — skill available, CLI ready",
			},
		});

		const ctx = { cwd: "/repo" };
		await pi.trigger("session_start", { type: "session_start" }, ctx);

		const first = await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "base prompt" },
			ctx,
		);
		const second = await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "base prompt" },
			ctx,
		);

		expect(first[0]).toEqual({
			systemPrompt: "base prompt\n\nYou are running inside cmux.",
			message: {
				customType: "cmux-detected",
				content: "cmux detected — skill available, CLI ready",
				display: true,
				details: undefined,
			},
		});
		expect(second[0]).toEqual({
			systemPrompt: "base prompt\n\nYou are running inside cmux.",
			message: undefined,
		});
	});

	test("refresh forces a new detection pass", async () => {
		const pi = create_pi_stub();
		const detect = vi.fn().mockResolvedValueOnce({ enabled: false }).mockResolvedValueOnce({ enabled: true });

		const handle = register_conditional_feature(pi as any, {
			feature_name: "demo",
			detect,
			should_activate: (state) => state.enabled,
		});

		await handle.refresh({ cwd: "/repo", reason: "startup" });
		const snapshot = await handle.refresh({ cwd: "/repo", reason: "startup" });

		expect(detect).toHaveBeenCalledTimes(2);
		expect(snapshot.active).toBe(true);
		expect(snapshot.detected).toBe(true);
	});
});
