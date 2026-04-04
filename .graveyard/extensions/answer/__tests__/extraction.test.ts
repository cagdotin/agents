import { describe, expect, it } from "vitest";
import { type ModelRegistry, parse_extraction_result, select_extraction_model } from "../extraction.js";

// ---------------------------------------------------------------------------
// parse_extraction_result
// ---------------------------------------------------------------------------

describe("parse_extraction_result", () => {
	it("parses valid JSON", () => {
		const text = '{"questions": [{"question": "What is your preferred DB?", "context": "MySQL or Postgres"}]}';
		const result = parse_extraction_result(text);
		expect(result).not.toBeNull();
		expect(result!.questions.length).toBe(1);
		expect(result!.questions[0].question).toBe("What is your preferred DB?");
		expect(result!.questions[0].context).toBe("MySQL or Postgres");
	});

	it("parses markdown-fenced JSON", () => {
		const text = '```json\n{"questions": [{"question": "Use TS?"}]}\n```';
		const result = parse_extraction_result(text);
		expect(result).not.toBeNull();
		expect(result!.questions.length).toBe(1);
	});

	it("parses markdown-fenced without language tag", () => {
		const text = '```\n{"questions": [{"question": "Use TS?"}]}\n```';
		const result = parse_extraction_result(text);
		expect(result).not.toBeNull();
	});

	it("returns null for invalid JSON", () => {
		expect(parse_extraction_result("not json at all")).toBeNull();
	});

	it("returns null for missing questions array", () => {
		expect(parse_extraction_result('{"answers": []}')).toBeNull();
	});

	it("returns null for questions not being an array", () => {
		expect(parse_extraction_result('{"questions": "not an array"}')).toBeNull();
	});

	it("returns null when question entries are malformed", () => {
		expect(parse_extraction_result('{"questions": [{"context": "missing question"}]}')).toBeNull();
	});

	it("handles empty questions array", () => {
		const result = parse_extraction_result('{"questions": []}');
		expect(result).not.toBeNull();
		expect(result!.questions).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// select_extraction_model
// ---------------------------------------------------------------------------

describe("select_extraction_model", () => {
	const current_model = { provider: "anthropic", id: "claude-current" };

	it("prefers Codex when available with API key", async () => {
		const registry: ModelRegistry = {
			find: (provider, id) => {
				if (provider === "openai-codex") return { provider, id };
				return undefined;
			},
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test-key" }),
		};
		const result = await select_extraction_model(current_model, registry);
		expect(result.provider).toBe("openai-codex");
	});

	it("falls back to Haiku when Codex unavailable", async () => {
		const registry: ModelRegistry = {
			find: (provider, id) => {
				if (provider === "anthropic" && id.includes("haiku")) return { provider, id };
				return undefined;
			},
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test-key" }),
		};
		const result = await select_extraction_model(current_model, registry);
		expect(result.provider).toBe("anthropic");
		expect(result.id).toContain("haiku");
	});

	it("falls back to current model when no API keys", async () => {
		const registry: ModelRegistry = {
			find: () => undefined,
			getApiKeyAndHeaders: async () => ({ ok: false, error: "No API key" }),
		};
		const result = await select_extraction_model(current_model, registry);
		expect(result).toBe(current_model);
	});

	it("skips Codex when API key missing", async () => {
		const registry: ModelRegistry = {
			find: (provider, id) => {
				if (provider === "openai-codex") return { provider, id };
				if (provider === "anthropic") return { provider, id };
				return undefined;
			},
			getApiKeyAndHeaders: async (model) => {
				if (model.provider === "openai-codex") return { ok: false, error: "No key" };
				return { ok: true, apiKey: "haiku-key" };
			},
		};
		const result = await select_extraction_model(current_model, registry);
		expect(result.provider).toBe("anthropic");
	});
});
