/**
 * cmux Extension
 *
 * Detects when Pi is running inside cmux and provides:
 * 1. Skill injection — cmux skill registered for on-demand loading
 * 2. Notification — native macOS notifications + flash when agent finishes
 * 3. Tab title — project, model, session, working status in the tab
 * 4. Sidebar status — pill showing agent idle/working state
 *
 * The skill files live in ./skills/cmux/ — standard SKILL.md + references.
 * The agent uses `read` to load them, just like any other Pi skill.
 *
 * See README.md for full documentation.
 */

import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { has_cmux_cli, is_cmux } from "./detect.js";
import { register_notify } from "./notify.js";
import { register_tab_title } from "./tab-title.js";

const CMUX_INJECTED_MESSAGE_TYPE = "cmux-detected";

/** Resolve the absolute path to the cmux SKILL.md bundled with this extension. */
function get_skill_path(): string {
	return path.resolve(path.dirname(new URL(import.meta.url).pathname), "skills", "cmux", "SKILL.md");
}

const CMUX_NUDGE = `
You are running inside **cmux**, a macOS terminal multiplexer. The \`cmux\` CLI is available for controlling windows, workspaces, panes, surfaces, browser panels, and markdown viewers. Use the cmux skill for reference.
`.trim();

export default function cmux_extension(pi: ExtensionAPI) {
	if (!is_cmux()) return;
	if (!has_cmux_cli()) return;

	const skill_path = get_skill_path();
	const surface_id = process.env.CMUX_SURFACE_ID ?? "";

	// Register notification and tab title sub-modules
	if (surface_id) {
		register_notify(pi, surface_id);
		register_tab_title(pi, surface_id);
	}

	// Inject the cmux skill into the system prompt
	pi.on("before_agent_start", async (event, ctx) => {
		ctx.ui.setStatus("cmux", "⊞ cmux");

		const skill_entry = [
			"<skill>",
			"    <name>cmux</name>",
			"    <description>Control cmux topology and routing — windows, workspaces, panes, surfaces, browser panels, and markdown viewers via CLI. Use when you need to manage terminal layout, open browser panels, or display markdown alongside your work.</description>",
			`    <location>${skill_path}</location>`,
			"  </skill>",
		].join("\n");

		let system_prompt = event.systemPrompt;

		if (system_prompt.includes("</available_skills>")) {
			system_prompt = system_prompt.replace("</available_skills>", `  ${skill_entry}\n</available_skills>`);
		} else {
			system_prompt += `\n\n<available_skills>\n  ${skill_entry}\n</available_skills>`;
		}

		system_prompt += `\n\n${CMUX_NUDGE}`;

		return {
			systemPrompt: system_prompt,
			message: {
				customType: CMUX_INJECTED_MESSAGE_TYPE,
				content: "cmux detected — skill available, CLI ready",
				display: true,
				details: {},
			},
		};
	});
}
