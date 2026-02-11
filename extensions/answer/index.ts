/**
 * Q&A extraction extension – entry point.
 *
 * Registers the `/answer` command and the `Ctrl+.` shortcut.
 * Both trigger the same flow: extract questions from the last
 * assistant message and present an interactive Q&A interface.
 *
 * @see {@link ./command.ts} for the full handler logic.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { create_answer_handler } from "./command.js";

export default function answer_extension(pi: ExtensionAPI) {
	const handler = create_answer_handler(pi);

	pi.registerCommand("answer", {
		description: "Extract questions from last assistant message into interactive Q&A",
		handler: (_args, ctx) => handler(ctx),
	});

	pi.registerShortcut("ctrl+.", {
		description: "Extract and answer questions",
		handler,
	});
}
