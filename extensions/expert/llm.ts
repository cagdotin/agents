/**
 * LLM call helper for the expert extension.
 *
 * Spawns `pi -p` in non-interactive mode to run a completion.
 * The subprocess handles its own auth, model selection, and API keys.
 * Input is piped via stdin to avoid OS argument length limits.
 */

import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Run a completion via `pi -p`
// ---------------------------------------------------------------------------

/**
 * Run a single LLM completion by spawning `pi -p`.
 * The prompt is piped via stdin (not as a CLI arg) to handle large inputs.
 * Returns the response text or throws on error.
 *
 * @param system_prompt - System prompt for the completion
 * @param user_text - User message content (piped via stdin)
 * @param model - Optional model override (e.g. "anthropic/claude-haiku-4-5")
 * @param signal - Optional abort signal
 */
export function run_completion(
	system_prompt: string,
	user_text: string,
	model?: string,
	signal?: AbortSignal,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const args = [
			"-p",
			"--no-tools",
			"--no-session",
			"--no-extensions",
			"--no-skills",
			"--no-prompt-templates",
			"--system-prompt", system_prompt,
		];

		if (model) {
			args.push("--model", model);
		}

		const child = spawn("pi", args, {
			stdio: ["pipe", "pipe", "pipe"],
			signal,
		});

		const stdout_chunks: Buffer[] = [];
		const stderr_chunks: Buffer[] = [];

		child.stdout.on("data", (chunk: Buffer) => stdout_chunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr_chunks.push(chunk));

		child.on("error", (err) => {
			if (err.name === "AbortError" || signal?.aborted) {
				reject(new Error("LLM call was aborted"));
			} else {
				reject(new Error(`pi -p failed to start: ${err.message}`));
			}
		});

		child.on("close", (code) => {
			const stdout = Buffer.concat(stdout_chunks).toString().trim();
			const stderr = Buffer.concat(stderr_chunks).toString().trim();

			if (code !== 0) {
				reject(new Error(`pi -p exited with code ${code}: ${stderr || "(no stderr)"}`));
				return;
			}

			if (!stdout) {
				reject(new Error("pi -p returned empty output"));
				return;
			}

			resolve(stdout);
		});

		// Pipe the user text via stdin and close it
		child.stdin.write(user_text);
		child.stdin.end();
	});
}
