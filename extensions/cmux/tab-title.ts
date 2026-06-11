/**
 * cmux Tab Title Sub-module
 *
 * Sets the cmux tab title to show project name, model, session title,
 * and agent working status — so you can distinguish multiple pi instances.
 *
 * Tab shows:
 *   π agents · sonnet-4 · fix login bug        (idle, with session title)
 *   π* agents · sonnet-4 · fix login bug       (agent working)
 *   π agents · sonnet-4                        (no session title)
 *
 * Also sets a cmux sidebar status pill showing agent state.
 *
 * Uses cmux rename-tab (surface-targeted) for the tab title and
 * cmux tab-action clear-name on shutdown to reset.
 */

import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { cmux, escape_shell } from "./shared.js";

const MARKER = "π";
const MAX_SESSION_TITLE_LEN = 30;

/**
 * Shorten model ID for display.
 *
 * Examples:
 *   claude-sonnet-4-20250514  → sonnet-4
 *   claude-opus-4-6           → opus-4-6
 *   gpt-5.3-codex             → gpt-5.3-codex
 *   o3                        → o3
 *   gemini-2.5-pro            → gemini-2.5-pro
 */
function shorten_model(id: string): string {
	let short = id;
	short = short.replace(/-\d{8}$/, "");
	short = short.replace(/^claude-/, "");
	return short;
}

/** Truncate with ellipsis */
function truncate(str: string, max: number): string {
	if (str.length <= max) return str;
	return `${str.slice(0, max - 1)}…`;
}

interface TitleContext {
	model?: { id: string };
	sessionManager: { getBranch(): any[] };
}

export function register_tab_title(pi: ExtensionAPI, surface_id: string, initial_ctx?: TitleContext): void {
	const project_name = basename(process.cwd());
	let model_name = "";
	let is_working = false;

	/** Get a display name for the current session. */
	const get_session_title = (ctx?: TitleContext): string | undefined => {
		const name = pi.getSessionName();
		if (name) return name;

		if (!ctx) return undefined;
		try {
			for (const entry of ctx.sessionManager.getBranch()) {
				if (entry.type === "message" && entry.message?.role === "user" && Array.isArray(entry.message.content)) {
					const text_part = entry.message.content.find((c: any) => c.type === "text");
					if (text_part?.text) {
						const first_line = text_part.text.split("\n")[0].trim();
						if (first_line) return first_line;
					}
				}
			}
		} catch {
			// Ignore
		}
		return undefined;
	};

	/** Build and set the tab title */
	const update_title = (ctx?: TitleContext) => {
		const status_icon = is_working ? `${MARKER}*` : MARKER;
		const model_part = model_name ? ` · ${model_name}` : "";
		const session_title = get_session_title(ctx);
		const session_part = session_title ? ` · ${truncate(session_title, MAX_SESSION_TITLE_LEN)}` : "";

		const title = `${status_icon} ${project_name}${model_part}${session_part}`;
		cmux(`rename-tab --surface '${escape_shell(surface_id)}' '${escape_shell(title)}'`);
	};

	/** Update the sidebar status pill */
	const update_status = () => {
		if (is_working) {
			cmux('set-status pi "working" --icon sparkle --color "#f9e2af"');
		} else {
			cmux('set-status pi "idle" --icon sparkle');
		}
	};

	/** Clear tab title and status on exit */
	const clear_title = () => {
		cmux(`tab-action --tab '${escape_shell(surface_id)}' --action clear-name`);
		cmux('set-status pi ""');
	};

	if (initial_ctx?.model) {
		model_name = shorten_model(initial_ctx.model.id);
	}
	update_title(initial_ctx);
	update_status();

	// Session lifecycle
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.model) {
			model_name = shorten_model(ctx.model.id);
		}
		update_title(ctx);
		update_status();
	});

	pi.on("model_select", async (_event, ctx) => {
		model_name = shorten_model(_event.model.id);
		update_title(ctx);
	});

	// Agent lifecycle
	pi.on("agent_start", async (_event, ctx) => {
		is_working = true;
		update_title(ctx);
		update_status();
	});

	pi.on("agent_end", async (_event, ctx) => {
		is_working = false;
		update_title(ctx);
		update_status();
	});

	// Cleanup
	pi.on("session_shutdown", async () => {
		clear_title();
	});
}
