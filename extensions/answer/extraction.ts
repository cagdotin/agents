/**
 * Question extraction logic for the Q&A extension.
 *
 * Handles model selection (preferring cheap/fast models) and the actual
 * LLM call that extracts questions from assistant text. Also provides
 * a parser for the structured JSON response.
 */

import { type Api, complete, type Model, type UserMessage } from "@mariozechner/pi-ai";
import { CODEX_MODEL_ID, EXTRACTION_SYSTEM_PROMPT, HAIKU_MODEL_ID } from "./constants.js";
import type { ExtractionResult } from "./types.js";

// ---------------------------------------------------------------------------
// Model registry interface (subset used by this module)
// ---------------------------------------------------------------------------

export interface ModelRegistry {
	find: (provider: string, model_id: string) => Model<Api> | undefined;
	getApiKey: (model: Model<Api>) => Promise<string | undefined>;
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
		const api_key = await registry.getApiKey(codex_model);
		if (api_key) return codex_model;
	}

	const haiku_model = registry.find("anthropic", HAIKU_MODEL_ID);
	if (haiku_model) {
		const api_key = await registry.getApiKey(haiku_model);
		if (api_key) return haiku_model;
	}

	return current_model;
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

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
		if (parsed && Array.isArray(parsed.questions)) {
			return parsed as ExtractionResult;
		}
		return null;
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
	const api_key = await registry.getApiKey(model);

	const user_message: UserMessage = {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	};

	const response = await complete(
		model,
		{ systemPrompt: EXTRACTION_SYSTEM_PROMPT, messages: [user_message] },
		{ apiKey: api_key, signal },
	);

	if (response.stopReason === "aborted") return null;

	const response_text = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");

	return parse_extraction_result(response_text);
}
