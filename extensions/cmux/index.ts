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
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";
import { has_cmux_cli, is_cmux } from "./detect.js";
import { register_notify } from "./notify.js";
import { register_tab_title } from "./tab-title.js";

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

const has_cmux_activation_message = (ctx: ExtensionContext) =>
	ctx.sessionManager
		.getEntries()
		.some((entry) => entry.type === "custom_message" && entry.customType === CMUX_ACTIVATION_MESSAGE.customType);

function register_activation_message(pi: ExtensionAPI) {
	pi.on("before_agent_start", (_event, ctx) => {
		if (has_cmux_activation_message(ctx)) return;

		return {
			message: {
				customType: CMUX_ACTIVATION_MESSAGE.customType,
				content: CMUX_ACTIVATION_MESSAGE.content,
				display: true,
			},
		};
	});
}

export default function cmux_extension(pi: ExtensionAPI) {
	register_conditional_feature(pi, {
		init: (_ctx) => ({ enabled: is_cmux() && has_cmux_cli() }),
		get_skills: (_config) => [get_skill_path()],
		get_instructions: (_config) => CMUX_HINT,
		activate: (ctx, _config) => {
			ctx.ui.setStatus("cmux", "⊞ cmux");
			register_activation_message(pi);

			const surface_id = process.env.CMUX_SURFACE_ID ?? null;

			if (!surface_id) return;

			register_notify(pi, surface_id);
			register_tab_title(pi, surface_id, ctx);
		},
	});
}
