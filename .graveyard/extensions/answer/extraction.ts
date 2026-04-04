/**
 * Question extraction logic for the Q&A extension.
 *
 * Handles model selection (preferring cheap/fast models) and the actual
 * LLM call that extracts questions from assistant text. Also provides
 * a parser for the structured JSON response.
 */

import { type Api, complete, type Model, type UserMessage } from "@mariozechner/pi-ai";
import { z } from "zod";
import { CODEX_MODEL_ID, EXTRACTION_SYSTEM_PROMPT, HAIKU_MODEL_ID } from "./constants.js";
import type { ExtractionResult } from "./types.js";

// ---------------------------------------------------------------------------
// Model registry interface (subset used by this module)
// ---------------------------------------------------------------------------

export type ResolvedRequestAuth =
	| { ok: true; apiKey?: string; headers?: Record<string, string> }
	| { ok: false; error: string };

export interface ModelRegistry {
	find: (provider: string, model_id: string) => Model<Api> | undefined;
	getApiKeyAndHeaders: (model: Model<Api>) => Promise<ResolvedRequestAuth>;
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

/**
 * Select the best model for extraction.
 *
 * Preference order:
 *   1. OpenAI Codex mini – fast, cheap, good at structured output
 *   2. Claude Haiku 4.5 – lightweight Anthropic fallback
 *   3. Current session model – whatever the user has selected
 *
 * A model is only chosen if the registry holds a valid API key for it.
 */
export async function select_extraction_model(current_model: Model<Api>, registry: ModelRegistry): Promise<Model<Api>> {
	const codex_model = registry.find("openai-codex", CODEX_MODEL_ID);
	if (codex_model) {
		const auth = await registry.getApiKeyAndHeaders(codex_model);
		if (auth.ok) return codex_model;
	}

	const haiku_model = registry.find("anthropic", HAIKU_MODEL_ID);
	if (haiku_model) {
		const auth = await registry.getApiKeyAndHeaders(haiku_model);
		if (auth.ok) return haiku_model;
	}

	return current_model;
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

const extracted_question_schema = z
	.object({
		question: z.string().trim().min(1),
		context: z.string().optional(),
	})
	.passthrough();

const extraction_result_schema = z
	.object({
		questions: z.array(extracted_question_schema),
	})
	.passthrough();

/**
 * Parse the LLM response text into a structured {@link ExtractionResult}.
 *
 * Handles responses that may be wrapped in markdown code fences.
 * Returns `null` when parsing fails or the shape is unexpected.
 */
export function parse_extraction_result(text: string): ExtractionResult | null {
	try {
		let json_str = text;

		// Strip markdown code fences if present
		const json_match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (json_match) {
			json_str = json_match[1].trim();
		}

		const parsed = JSON.parse(json_str);
		const result = extraction_result_schema.safeParse(parsed);
		if (!result.success) {
			return null;
		}

		return result.data as ExtractionResult;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Extraction call
// ---------------------------------------------------------------------------

/**
 * Run question extraction against the given model.
 *
 * Sends the assistant text as a user message with the extraction system
 * prompt, then parses the response into structured questions.
 *
 * @param model        - The model to use for extraction.
 * @param registry     - Model registry (used to fetch the API key).
 * @param text         - The assistant message text to extract questions from.
 * @param signal       - Optional abort signal for cancellation.
 * @returns The extraction result, or `null` on abort / parse failure.
 */
export async function extract_questions(
	model: Model<Api>,
	registry: ModelRegistry,
	text: string,
	signal?: AbortSignal,
): Promise<ExtractionResult | null> {
	const auth = await registry.getApiKeyAndHeaders(model);
	if (!auth.ok) throw new Error(auth.error);

	const user_message: UserMessage = {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	};

	const response = await complete(
		model,
		{ systemPrompt: EXTRACTION_SYSTEM_PROMPT, messages: [user_message] },
		{ apiKey: auth.apiKey, headers: auth.headers, signal },
	);

	if (response.stopReason === "aborted") return null;

	const response_text = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");

	return parse_extraction_result(response_text);
}
