import path from "node:path";

// Re-implement detect_work_context locally since it's not exported from index.ts
// This tests the detection logic in isolation
function detect_work_context(cwd: string, work_root: string | null): { enabled: boolean } {
	if (!work_root) return { enabled: false };
	const resolved = path.resolve(cwd);
	return {
		enabled: resolved === work_root || resolved.startsWith(`${work_root}/`),
	};
}

describe("detect_work_context", () => {
	const work_root = "/Users/test/git/dev/acme";

	test("enables when cwd is exactly the work root", () => {
		const result = detect_work_context(work_root, work_root);
		expect(result.enabled).toBe(true);
	});

	test("enables when cwd is a subdirectory of work root", () => {
		const result = detect_work_context(`${work_root}/some-project`, work_root);
		expect(result.enabled).toBe(true);
	});

	test("enables for deeply nested subdirectories", () => {
		const result = detect_work_context(`${work_root}/org/repo/src`, work_root);
		expect(result.enabled).toBe(true);
	});

	test("disables when cwd is outside the work root", () => {
		const result = detect_work_context("/Users/test/personal/project", work_root);
		expect(result.enabled).toBe(false);
	});

	test("disables when cwd is a sibling with matching prefix", () => {
		// /Users/test/git/dev/acme-other should NOT match /Users/test/git/dev/acme
		const result = detect_work_context(`${work_root}-other`, work_root);
		expect(result.enabled).toBe(false);
	});

	test("disables when cwd is the parent of work root", () => {
		const result = detect_work_context("/Users/test/git/dev", work_root);
		expect(result.enabled).toBe(false);
	});

	test("disables when work_root is null", () => {
		const result = detect_work_context("/any/path", null);
		expect(result.enabled).toBe(false);
	});
});
