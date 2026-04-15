import { build_prompt_hint, footer_text } from "../../features/indexed.js";

describe("footer_text", () => {
	test("returns undefined when binding is undefined", () => {
		expect(footer_text(undefined, undefined)).toBeUndefined();
	});

	test("returns undefined when not indexed", () => {
		expect(footer_text({ status: "not_indexed", repo_root: "/repo" } as any, undefined)).toBeUndefined();
	});

	test("shows indexed checkmark when fresh", () => {
		const binding = { status: "indexed", repo_root: "/repo", collection_key: "test" } as any;
		expect(footer_text(binding, { status: "fresh" })).toBe("qmd: indexed ✓");
	});

	test("shows indexed checkmark when freshness is undefined", () => {
		const binding = { status: "indexed", repo_root: "/repo", collection_key: "test" } as any;
		expect(footer_text(binding, undefined)).toBe("qmd: indexed ✓");
	});

	test("shows stale count when stale", () => {
		const binding = { status: "indexed", repo_root: "/repo", collection_key: "test" } as any;
		const freshness = { status: "stale", changed_count: 3, changed_paths: ["a.md", "b.md", "c.md"] } as any;
		expect(footer_text(binding, freshness)).toBe("qmd: indexed · 3 stale");
	});

	test("shows freshness unknown fallback", () => {
		const binding = { status: "indexed", repo_root: "/repo", collection_key: "test" } as any;
		const freshness = { status: "unknown", reason: "no git" } as any;
		expect(footer_text(binding, freshness)).toBe("qmd: indexed · freshness unknown");
	});
});

describe("build_prompt_hint", () => {
	test("includes collection key and skill path", () => {
		const hint = build_prompt_hint("my_repo", "/path/to/SKILL.md");
		expect(hint).toContain("collection: `my_repo`");
		expect(hint).toContain('qmd query -c my_repo "your question here"');
		expect(hint).toContain('qmd search "exact keywords" -c my_repo');
		expect(hint).toContain("/path/to/SKILL.md");
	});

	test("includes usage guidance", () => {
		const hint = build_prompt_hint("test", "/skill.md");
		expect(hint).toContain("Use QMD before rg/grep when:");
		expect(hint).toContain("Use rg/grep instead");
	});
});
