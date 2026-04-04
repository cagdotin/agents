/**
 * Tmux Extension
 *
 * Unified tmux integration for Pi, combining:
 * - Notification badges + sound when agent finishes (notify)
 * - Pane title showing project, model, session, and status (pane-title)
 *
 * Requirements:
 * - Running inside tmux ($TMUX set)
 * - macOS for notification sound (gracefully skipped otherwise)
 *
 * See README.md for full documentation and tmux.conf setup.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { register_notify } from "./notify.js";
import { register_pane_title } from "./pane-title.js";
import { is_tmux, tmux } from "./shared.js";

export default function (pi: ExtensionAPI) {
	if (!is_tmux()) return;

	// Capture pane ID at startup — this is stable and unique to our pane.
	// All tmux queries use -t with this ID so they target the correct pane
	// even when the user is focused on a different one.
	const pane_id = tmux("display-message -p '#{pane_id}'");
	if (!pane_id) return;

	register_notify(pi, pane_id);
	register_pane_title(pi, pane_id);
}
