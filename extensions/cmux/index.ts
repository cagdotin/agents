/**
 * cmux Extension
 *
 * Detects when Pi is running inside cmux and provides:
 * 1. Conditional skill discovery — cmux skill exposed only in cmux sessions
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
import { register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";
import { has_cmux_cli, is_cmux } from "./detect.js";
import { register_notify } from "./notify.js";
import { register_tab_title } from "./tab-title.js";

interface CmuxFeatureState {
	inside_cmux: boolean;
	has_cli: boolean;
	surface_id: string;
	skill_path: string;
}

const CMUX_HINT = `
You are running inside **cmux**, a macOS terminal multiplexer. The \`cmux\` CLI is available for controlling windows, workspaces, panes, surfaces, browser panels, and markdown viewers. Use the cmux skill when the user needs layout control, surface management, browser panels, or other cmux topology operations.
`.trim();

const CMUX_ACTIVATION_MESSAGE = {
	customType: "cmux-detected",
	content: "cmux detected — skill available, CLI ready",
};

/** Resolve the absolute path to the cmux SKILL.md bundled with this extension. */
function get_skill_path(): string {
	return path.resolve(path.dirname(new URL(import.meta.url).pathname), "skills", "cmux", "SKILL.md");
}

export default function cmux_extension(pi: ExtensionAPI) {
	register_conditional_feature<CmuxFeatureState>(pi, {
		feature_name: "cmux",
		detect: () => ({
			inside_cmux: is_cmux(),
			has_cli: has_cmux_cli(),
			surface_id: process.env.CMUX_SURFACE_ID ?? "",
			skill_path: get_skill_path(),
		}),
		should_activate: (state) => state.inside_cmux && state.has_cli,
		activate: ({ ctx, state }) => {
			ctx.ui.setStatus("cmux", "⊞ cmux");

			if (!state.surface_id) {
				return;
			}

			register_notify(pi, state.surface_id);
			register_tab_title(pi, state.surface_id, ctx);
		},
		skill_paths: (state) => [state.skill_path],
		system_prompt_hint: CMUX_HINT,
		activation_message: CMUX_ACTIVATION_MESSAGE,
	});
}
