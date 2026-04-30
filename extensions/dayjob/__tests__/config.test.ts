import { workspace_config_schema } from "../constants.js";

describe("workspace_config_schema", () => {
	test("accepts valid config with ~/", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["~/git/dev/company"],
			linear: { team: "ACME" },
		});
		expect(result.success).toBe(true);
	});

	test("accepts multiple work roots", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["~/git/dev/company", "~/git/dev/other"],
			linear: { team: "ACME" },
		});
		expect(result.success).toBe(true);
	});

	test("rejects work_root without ~/", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["/absolute/path"],
			linear: { team: "ACME" },
		});
		expect(result.success).toBe(false);
	});

	test("rejects if any work_root is invalid", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["~/valid/path", "/invalid/path"],
			linear: { team: "ACME" },
		});
		expect(result.success).toBe(false);
	});

	test("rejects empty work_roots array", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: [],
			linear: { team: "ACME" },
		});
		expect(result.success).toBe(false);
	});

	test("rejects work_root with relative path", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["relative/path"],
			linear: { team: "ACME" },
		});
		expect(result.success).toBe(false);
	});

	test("rejects empty team string", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["~/git/dev/company"],
			linear: { team: "" },
		});
		expect(result.success).toBe(false);
	});

	test("rejects missing linear field", () => {
		const result = workspace_config_schema.safeParse({
			work_roots: ["~/git/dev/company"],
		});
		expect(result.success).toBe(false);
	});
});

describe("work_root resolution", () => {
	test("resolves ~ to HOME", () => {
		const config = workspace_config_schema.parse({
			work_roots: ["~/git/dev/company"],
			linear: { team: "ACME" },
		});
		const resolved = config.work_roots[0].replace(/^~/, "/test/home");
		expect(resolved).toBe("/test/home/git/dev/company");
	});

	test("rejects invalid data shapes", () => {
		expect(workspace_config_schema.safeParse({}).success).toBe(false);
		expect(workspace_config_schema.safeParse("not json").success).toBe(false);
		expect(workspace_config_schema.safeParse(null).success).toBe(false);
	});
});
