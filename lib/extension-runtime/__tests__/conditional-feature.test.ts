import { register_conditional_feature } from "../conditional-feature.js";

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
	test("initializes state once and activates once when enabled", async () => {
		const pi = create_pi_stub();
		const init = vi.fn((ctx: { cwd: string }) => ({
			enabled: true,
			cwd: ctx.cwd,
		}));
		const activate = vi.fn();

		register_conditional_feature(pi as any, {
			init,
			activate,
		});

		const ctx = { cwd: "/repo" };
		await pi.trigger("session_start", { type: "session_start", reason: "startup" }, ctx);
		await pi.trigger("session_start", { type: "session_start", reason: "resume" }, ctx);

		expect(init).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledWith(
			expect.objectContaining({ cwd: "/repo" }),
			expect.objectContaining({ enabled: true, cwd: "/repo" }),
		);
	});

	test("reuses initialized state for resource discovery and instructions", async () => {
		const pi = create_pi_stub();
		const init = vi.fn((ctx: { cwd: string }) => ({
			enabled: true,
			cwd: ctx.cwd,
			instructions: "  Frontend repo detected.  ",
		}));

		register_conditional_feature(pi as any, {
			init,
			activate: () => {},
			get_skills: (state) => ["", `${state.cwd}/skills/frontend.md`],
			get_prompts: (state) => [`${state.cwd}/prompts/frontend.md`],
			get_instructions: (state) => state.instructions,
		});

		const ctx = { cwd: "/repo" };
		await pi.trigger("session_start", { type: "session_start", reason: "startup" }, ctx);
		const resource_results = await pi.trigger(
			"resources_discover",
			{ type: "resources_discover", cwd: "/repo", reason: "startup" },
			ctx,
		);
		const prompt_results = await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "base prompt" },
			ctx,
		);

		expect(init).toHaveBeenCalledTimes(1);
		expect(resource_results[0]).toEqual({
			skillPaths: ["", "/repo/skills/frontend.md"],
			promptPaths: ["/repo/prompts/frontend.md"],
		});
		expect(prompt_results[0]).toEqual({
			systemPrompt: "base prompt\n\nFrontend repo detected.",
		});
	});

	test("does not activate, expose resources, or add instructions when disabled", async () => {
		const pi = create_pi_stub();
		const activate = vi.fn();

		register_conditional_feature(pi as any, {
			init: () => ({ enabled: false, instructions: "ignored" }),
			activate,
			get_skills: () => ["/tmp/skill.md"],
			get_prompts: () => ["/tmp/prompt.md"],
			get_instructions: (state) => state.instructions,
		});

		const ctx = { cwd: "/repo" };
		await pi.trigger("session_start", { type: "session_start", reason: "startup" }, ctx);
		const resource_results = await pi.trigger(
			"resources_discover",
			{ type: "resources_discover", cwd: "/repo", reason: "startup" },
			ctx,
		);
		const prompt_results = await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "base prompt" },
			ctx,
		);

		expect(activate).not.toHaveBeenCalled();
		expect(resource_results[0]).toBeUndefined();
		expect(prompt_results[0]).toBeUndefined();
	});

	test("returns undefined resource paths when getters are omitted", async () => {
		const pi = create_pi_stub();

		register_conditional_feature(pi as any, {
			init: () => ({ enabled: true }),
			activate: () => {},
		});

		const results = await pi.trigger(
			"resources_discover",
			{ type: "resources_discover", cwd: "/repo", reason: "startup" },
			{ cwd: "/repo" },
		);

		expect(results[0]).toEqual({
			skillPaths: undefined,
			promptPaths: undefined,
		});
	});

	test("does not inject blank instructions after trimming", async () => {
		const pi = create_pi_stub();

		register_conditional_feature(pi as any, {
			init: () => ({ enabled: true, instructions: "   " }),
			activate: () => {},
			get_instructions: (state) => state.instructions,
		});

		const results = await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "base prompt" },
			{ cwd: "/repo" },
		);

		expect(results[0]).toBeUndefined();
	});

	test("propagates synchronous initialization errors", async () => {
		const pi = create_pi_stub();

		register_conditional_feature(pi as any, {
			init: () => {
				throw new Error("init failed");
			},
			activate: () => {},
		});

		await expect(
			pi.trigger("session_start", { type: "session_start", reason: "startup" }, { cwd: "/repo" }),
		).rejects.toThrow("init failed");
	});

	test("propagates synchronous activation errors", async () => {
		const pi = create_pi_stub();

		register_conditional_feature(pi as any, {
			init: () => ({ enabled: true }),
			activate: () => {
				throw new Error("boom");
			},
		});

		await expect(
			pi.trigger("session_start", { type: "session_start", reason: "startup" }, { cwd: "/repo" }),
		).rejects.toThrow("boom");
	});
});
