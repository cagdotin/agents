import { describe, expect, it, vi } from "vitest";

vi.mock("../../domain/repo-binding.js", () => ({
	detect_repo_binding: async () => ({
		status: "indexed",
		repo_root: "/tmp/repo",
		collection_key: "p_demo",
		marker: {
			schema_version: 1,
			repo_root: "/tmp/repo",
			collection_key: "p_demo",
			last_indexed_at: "2026-03-13T12:00:00.000Z",
			last_indexed_commit: "abc123",
			created_at: "2026-03-13T11:00:00.000Z",
		},
		source: "marker",
	}),
}));

vi.mock("../../domain/freshness.js", () => ({
	check_freshness: async () => ({ status: "fresh" }),
}));

vi.mock("../../core/qmd-store.js", () => ({
	close_store: async () => {},
}));

import {
	bootstrap_runtime_state,
	build_qmd_prompt_hint,
	type QmdExtensionState,
	register_runtime,
} from "../../extension/runtime.js";

function create_mock_pi() {
	const handlers = new Map<string, Array<(event: any, ctx: any) => Promise<any>>>();
	return {
		on(event_name: string, handler: (event: any, ctx: any) => Promise<any>) {
			const list = handlers.get(event_name) ?? [];
			list.push(handler);
			handlers.set(event_name, list);
		},
		async trigger(event_name: string, event: any, ctx: any) {
			let result: any;
			for (const handler of handlers.get(event_name) ?? []) {
				result = await handler(event, ctx);
			}
			return result;
		},
	};
}

function create_mock_ctx() {
	const statuses = new Map<string, string | undefined>();
	return {
		cwd: "/tmp/repo",
		statuses,
		ui: {
			setStatus(key: string, value: string | undefined) {
				statuses.set(key, value);
			},
		},
	};
}

describe("runtime hooks", () => {
	it("boots runtime state and sets a quiet indexed footer", async () => {
		const pi = create_mock_pi();
		const state: QmdExtensionState = {};
		register_runtime(pi as any, state);

		const ctx = create_mock_ctx();
		await bootstrap_runtime_state(ctx as any, state);
		expect(ctx.statuses.get("qmd")).toBe("qmd: indexed ✓");
	});

	it("injects only the init workflow prompt from runtime hooks", async () => {
		const pi = create_mock_pi();
		const state: QmdExtensionState = {
			init_workflow: {
				repo_root: "/tmp/repo",
				prompt: "Review this QMD proposal.",
			},
		};
		register_runtime(pi as any, state);

		const result = await pi.trigger("before_agent_start", { systemPrompt: "base" }, create_mock_ctx());
		expect(result.systemPrompt).toContain("# QMD Init Workflow");
		expect(result.systemPrompt).toContain("Review this QMD proposal.");
	});

	it("builds a collection-aware QMD prompt hint", () => {
		const hint = build_qmd_prompt_hint("p_demo", "/tmp/extensions/qmd/skills/qmd/SKILL.md");
		expect(hint).toContain("This repository is indexed by QMD (collection: `p_demo`).");
		expect(hint).toContain('qmd query -c p_demo "your question here"');
		expect(hint).toContain("Use QMD before rg/grep when:");
		expect(hint).toContain("/tmp/extensions/qmd/skills/qmd/SKILL.md");
	});
});
