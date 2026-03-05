import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { REFLECTION_PROMPT } from "./constants.js";
import {
	read_expertise,
	write_expertise,
	append_reflection_log,
	get_expertise_dir,
} from "./storage.js";
import { format_conversation_for_reflection } from "./helpers.js";
import type { ExpertiseSettings, ReflectionLogEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Reflection result
// ---------------------------------------------------------------------------

export interface ReflectionResult {
	updated_yaml: string;
	summary: string;
}

// ---------------------------------------------------------------------------
// Parse reflection output from the cheap model
// ---------------------------------------------------------------------------

export function parse_reflection_output(output: string): ReflectionResult | null {
	const yaml_match = output.match(
		/<updated_expertise>\s*\n?([\s\S]*?)\n?\s*<\/updated_expertise>/,
	);
	const summary_match = output.match(
		/<reflection_summary>\s*\n?([\s\S]*?)\n?\s*<\/reflection_summary>/,
	);

	if (!yaml_match) return null;

	return {
		updated_yaml: yaml_match[1].trim() + "\n",
		summary: summary_match ? summary_match[1].trim() : "Expertise updated (no summary provided)",
	};
}

// ---------------------------------------------------------------------------
// Build the reflection input
// ---------------------------------------------------------------------------

function build_reflection_input(
	current_expertise_yaml: string,
	conversation: string,
): string {
	return `${REFLECTION_PROMPT}

---

## Current Expertise File

\`\`\`yaml
${current_expertise_yaml}
\`\`\`

## Conversation Transcript

${conversation}`;
}

// ---------------------------------------------------------------------------
// Run reflection via a cheap model subprocess
// ---------------------------------------------------------------------------

export async function run_reflection(
	pi: ExtensionAPI,
	domain: string,
	messages: any[],
	settings: ExpertiseSettings,
	cwd: string,
	session_file: string,
): Promise<ReflectionResult | { error: string }> {
	const expertise_dir = get_expertise_dir(cwd);
	const existing = await read_expertise(expertise_dir, domain);

	if (!existing) {
		return { error: `Domain '${domain}' not found` };
	}

	// Format conversation
	const conversation = format_conversation_for_reflection(messages);
	if (!conversation.trim()) {
		return { error: "No conversation content to reflect on" };
	}

	// Build the full prompt
	const prompt = build_reflection_input(existing.raw, conversation);

	// Write to temp file for the subprocess
	const temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-expert-"));
	const prompt_file = path.join(temp_dir, "reflection-prompt.md");
	await fs.writeFile(prompt_file, prompt, "utf8");

	try {
		// Build pi command args
		const args = [
			"-p",
			"--no-tools",
			"--no-session",
			"--no-extensions",
			"--no-skills",
		];

		if (settings.reflection_model) {
			args.push("--model", settings.reflection_model);
		}

		args.push(`@${prompt_file}`);

		const result = await pi.exec("pi", args, { timeout: 120_000 });

		if (result.code !== 0) {
			const stderr = result.stderr?.trim() || "Unknown error";
			return { error: `Reflection model failed: ${stderr}` };
		}

		const output = result.stdout?.trim() || "";
		const parsed = parse_reflection_output(output);

		if (!parsed) {
			return { error: "Failed to parse reflection output — model did not return expected format" };
		}

		// Write the updated expertise
		await write_expertise(expertise_dir, domain, parsed.updated_yaml);

		// Determine which model was actually used for the log
		const model_label = settings.reflection_model || "current session model";

		// Append to reflection log
		const log_entry: ReflectionLogEntry = {
			date: new Date().toISOString(),
			domain,
			session: session_file,
			model: model_label,
			summary: parsed.summary,
		};
		await append_reflection_log(expertise_dir, log_entry);

		return parsed;
	} finally {
		// Clean up temp files
		await fs.rm(temp_dir, { recursive: true, force: true }).catch(() => {});
	}
}
