/**
 * Helper utilities for the Q&A extraction extension.
 *
 * Small, pure functions shared across the extension modules –
 * message scanning, answer formatting, and ANSI color helpers.
 */

import type { ExtractedQuestion } from "./types.js";

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

export const ansi = {
	dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
	bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
	cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
	green: (s: string) => `\x1b[32m${s}\x1b[0m`,
	yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
	gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
} as const;

// ---------------------------------------------------------------------------
// Session message scanning
// ---------------------------------------------------------------------------

/**
 * Walk the current session branch backwards and return the text of the
 * last complete assistant message.
 *
 * Returns an object with either `text` (success) or `error` (failure).
 */
export function find_last_assistant_text(branch: readonly any[]): { text: string } | { error: string } {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type !== "message") continue;

		const msg = entry.message;
		if (!("role" in msg) || msg.role !== "assistant") continue;

		if (msg.stopReason !== "stop") {
			return { error: `Last assistant message incomplete (${msg.stopReason})` };
		}

		const text_parts = msg.content
			.filter((c: any): c is { type: "text"; text: string } => c.type === "text")
			.map((c: { text: string }) => c.text);

		if (text_parts.length > 0) {
			return { text: text_parts.join("\n") };
		}
	}

	return { error: "No assistant messages found" };
}

// ---------------------------------------------------------------------------
// Answer formatting
// ---------------------------------------------------------------------------

/**
 * Compile questions and answers into a readable text block suitable
 * for sending back as a user message.
 */
export function format_answers(questions: ExtractedQuestion[], answers: string[]): string {
	const parts: string[] = [];

	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		const a = answers[i]?.trim() || "(no answer)";
		parts.push(`Q: ${q.question}`);
		if (q.context) {
			parts.push(`> ${q.context}`);
		}
		parts.push(`A: ${a}`);
		parts.push("");
	}

	return parts.join("\n").trim();
}
