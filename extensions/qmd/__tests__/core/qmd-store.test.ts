import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
});

describe("core/qmd-store", () => {
	it("lists collections through the SDK wrapper", async () => {
		vi.doMock("@tobilu/qmd", () => ({
			createStore: vi.fn(async () => ({
				listCollections: async () => [
					{
						name: "demo",
						pwd: "/tmp/demo",
						glob_pattern: "**/*.md",
						doc_count: 1,
						active_count: 1,
						last_modified: null,
						includeByDefault: true,
					},
				],
				close: async () => {},
			})),
		}));

		const module = await import("../../core/qmd-store.js");
		const collections = await module.list_collections();
		expect(collections[0]?.name).toBe("demo");
		await module.close_store();
	});

	it("translates SDK failures into QmdUnavailableError", async () => {
		vi.doMock("@tobilu/qmd", () => ({
			createStore: vi.fn(async () => {
				throw new Error("boom");
			}),
		}));

		const module = await import("../../core/qmd-store.js");
		await expect(module.list_collections()).rejects.toThrow("QMD is unavailable");
	});
});
