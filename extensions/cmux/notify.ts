/**
 * cmux Notification Sub-module
 *
 * When the agent finishes processing (>3s):
 * 1. Plays a notification sound
 * 2. Sends a native macOS notification via cmux
 * 3. Flashes the surface tab if user is on a different workspace
 *
 * Behavior:
 * - Agent finishes (>3s) → sound plays + native notification sent (always)
 * - Agent finishes (>3s) + user on another workspace → trigger-flash on surface
 * - User sends new input → flash state implicitly clears
 */

import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { cmux, cmux_json, escape_shell } from "./shared.js";

/**
 * Notification sound. Pick from /System/Library/Sounds/:
 * Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse,
 * Ping, Pop, Purr, Sosumi, Submarine, Tink
 */
const SOUND = "Glass";
const SOUND_PATH = `/System/Library/Sounds/${SOUND}.aiff`;

/** Play a notification sound (non-blocking, fire-and-forget) */
const play_sound = (): void => {
	if (!existsSync(SOUND_PATH)) return;
	exec(`afplay ${SOUND_PATH}`, () => {});
};

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

		// Play sound + send native notification
		play_sound();
		cmux(`notify --title 'Pi' --body '${escape_shell(`Agent finished (${seconds}s)`)}'`);

		// Flash the surface tab if user is on a different workspace
		if (!is_workspace_focused()) {
			cmux(`trigger-flash --surface '${escape_shell(surface_id)}'`);
		}
	});
}
