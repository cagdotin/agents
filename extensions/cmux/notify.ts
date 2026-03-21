/**
 * cmux Notification Sub-module
 *
 * When the agent finishes processing (>3s):
 * 1. Sends a native macOS notification via cmux
 * 2. Flashes the surface tab if user is on a different workspace
 *
 * Behavior:
 * - Agent finishes (>3s) → native notification sent (always)
 * - Agent finishes (>3s) + user on another workspace → trigger-flash on surface
 * - User sends new input → flash state implicitly clears
 *
 * Unlike tmux, cmux handles notifications natively — no need for afplay
 * or BEL characters. cmux notify sends a real macOS notification,
 * and trigger-flash provides a visual indicator on the tab.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { cmux, cmux_json, escape_shell } from "./shared.js";

const MIN_DURATION_MS = 3000;

interface IdentifyResult {
	caller?: { workspace_ref?: string; surface_ref?: string };
	focused?: { workspace_ref?: string };
}

/** Check if our workspace is the one the user is currently looking at */
function is_workspace_focused(): boolean {
	const info = cmux_json<IdentifyResult>("identify");
	if (!info?.caller?.workspace_ref || !info?.focused?.workspace_ref) return true; // assume focused if we can't tell
	return info.caller.workspace_ref === info.focused.workspace_ref;
}

export function register_notify(pi: ExtensionAPI, surface_id: string): void {
	let start_time: number | null = null;

	pi.on("agent_start", async () => {
		start_time = Date.now();
	});

	pi.on("agent_end", async () => {
		if (start_time === null) return;

		const duration = Date.now() - start_time;
		start_time = null;

		if (duration < MIN_DURATION_MS) return;

		const seconds = Math.round(duration / 1000);

		// Always send native notification
		cmux(`notify --title 'Pi' --body '${escape_shell(`Agent finished (${seconds}s)`)}'`);

		// Flash the surface tab if user is on a different workspace
		if (!is_workspace_focused()) {
			cmux(`trigger-flash --surface '${escape_shell(surface_id)}'`);
		}
	});
}
