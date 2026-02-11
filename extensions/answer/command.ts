/**
 * Command handler for the `/answer` command.
 *
 * Orchestrates the full Q&A extraction flow:
 *   1. Find the last assistant message in the session branch.
 *   2. Select the best extraction model (cheap & fast preferred).
 *   3. Show a loading spinner while the LLM extracts questions.
 *   4. Present the interactive Q&A component for the user to answer.
 *   5. Send the compiled answers back as a user message and trigger
 *      a new assistant turn.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { find_last_assistant_text } from "./helpers.js";
import { select_extraction_model, extract_questions } from "./extraction.js";
import { QnAComponent } from "./components/qna-component.js";
import type { ExtractionResult } from "./types.js";

/**
 * Create the `/answer` command handler.
 *
 * The returned async function can be used both as a command handler
 * and as a shortcut handler (they share the same logic).
 */
export function create_answer_handler(pi: ExtensionAPI) {
	return async (ctx: ExtensionContext) => {
		// --- Guard: requires interactive mode ---
		if (!ctx.hasUI) {
			ctx.ui.notify("answer requires interactive mode", "error");
			return;
		}

		// --- Guard: requires a model ---
		if (!ctx.model) {
			ctx.ui.notify("No model selected", "error");
			return;
		}

		// --- Find the last assistant message ---
		const branch = ctx.sessionManager.getBranch();
		const result = find_last_assistant_text(branch);

		if ("error" in result) {
			ctx.ui.notify(result.error, "error");
			return;
		}

		const last_assistant_text = result.text;

		// --- Select extraction model ---
		const extraction_model = await select_extraction_model(ctx.model, ctx.modelRegistry);

		// --- Extract questions (with loading UI) ---
		const extraction_result = await ctx.ui.custom<ExtractionResult | null>(
			(tui, theme, _kb, done) => {
				const loader = new BorderedLoader(
					tui,
					theme,
					`Extracting questions using ${extraction_model.id}...`,
				);
				loader.onAbort = () => done(null);

				extract_questions(extraction_model, ctx.modelRegistry, last_assistant_text, loader.signal)
					.then(done)
					.catch(() => done(null));

				return loader;
			},
		);

		if (extraction_result === null) {
			ctx.ui.notify("Cancelled", "info");
			return;
		}

		if (extraction_result.questions.length === 0) {
			ctx.ui.notify("No questions found in the last message", "info");
			return;
		}

		// --- Present interactive Q&A ---
		const answers_text = await ctx.ui.custom<string | null>((tui, _theme, _kb, done) => {
			return new QnAComponent(extraction_result.questions, tui, done);
		});

		if (answers_text === null) {
			ctx.ui.notify("Cancelled", "info");
			return;
		}

		// --- Send answers and trigger a new assistant turn ---
		pi.sendMessage(
			{
				customType: "answers",
				content: "I answered your questions in the following way:\n\n" + answers_text,
				display: true,
			},
			{ triggerTurn: true },
		);
	};
}
