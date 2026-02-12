/**
 * Tmux Notification Badge Extension
 *
 * When an agent finishes processing and you're on a different tmux window,
 * this extension:
 * 1. Adds a badge (●) to the tmux window name
 * 2. Plays a notification sound
 * 3. Sends a BEL character for tmux monitor-bell highlighting
 *
 * Behavior:
 * - Agent finishes (>3s) → sound plays (regardless of which window you're on)
 * - Agent finishes (>3s) + you're on another window → badge (●) added to window name
 * - You switch back to the window or send input → badge clears automatically
 *
 * For bell highlighting to work, add to your ~/.tmux.conf:
 *   set-option -g bell-action other
 *   set-option -g monitor-bell on
 *
 * Requirements:
 * - Running inside tmux
 * - macOS (for afplay sound — gracefully skipped on other platforms)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync, exec } from "node:child_process";
import { existsSync } from "node:fs";

const BADGE = "●";
const MIN_DURATION_MS = 3000;

/**
 * Notification sound. Pick from /System/Library/Sounds/:
 * Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse,
 * Ping, Pop, Purr, Sosumi, Submarine, Tink
 */
const SOUND = "Glass";
const SOUND_PATH = `/System/Library/Sounds/${SOUND}.aiff`;

/** Check if we're running inside tmux */
const is_tmux = (): boolean => {
  return !!process.env.TMUX;
};

/** Run a tmux command, swallowing errors */
const tmux = (cmd: string): string => {
  try {
    return execSync(`tmux ${cmd}`, { encoding: "utf-8", timeout: 2000 }).trim();
  } catch {
    return "";
  }
};

/** Play a notification sound (non-blocking, fire-and-forget) */
const play_sound = (): void => {
  if (!existsSync(SOUND_PATH)) return;
  exec(`afplay ${SOUND_PATH}`, () => {});
};

/** Safely escape a string for use in tmux commands */
const escape_tmux = (str: string): string => {
  return str.replace(/'/g, "'\\''");
};

export default function (pi: ExtensionAPI) {
  if (!is_tmux()) return;

  // Capture pane ID at startup — this is stable and unique to our pane.
  // All tmux queries MUST use -t with this ID, otherwise tmux resolves
  // to the user's currently focused pane (wrong when they're on another window).
  const pane_id = tmux("display-message -p '#{pane_id}'");
  if (!pane_id) return;

  /** Get window name for OUR pane (not the user's current window) */
  const get_window_name = (): string => {
    return tmux(`display-message -t '${pane_id}' -p '#{window_name}'`);
  };

  /** Check if OUR window is the one the user is currently looking at */
  const is_window_active = (): boolean => {
    return tmux(`display-message -t '${pane_id}' -p '#{window_active}'`) === "1";
  };

  /** Rename OUR window */
  const rename_window = (name: string): void => {
    const escaped = escape_tmux(name);
    tmux(`rename-window -t '${pane_id}' '${escaped}'`);
  };

  let start_time: number | null = null;
  let original_name: string | null = null;
  let badge_active = false;
  let focus_check_interval: ReturnType<typeof setInterval> | null = null;

  const add_badge = () => {
    if (badge_active) return;

    const name = get_window_name();
    if (name.startsWith(BADGE)) return;

    original_name = name;
    badge_active = true;

    rename_window(`${BADGE} ${name}`);

    // Send BEL for monitor-bell highlighting (works if bell-action != none)
    process.stderr.write("\x07");

    // Poll for window focus to auto-clear badge when user switches back
    start_focus_polling();
  };

  const clear_badge = () => {
    if (!badge_active) return;
    badge_active = false;

    stop_focus_polling();

    if (original_name !== null) {
      const current_name = get_window_name();
      if (current_name.startsWith(BADGE)) {
        rename_window(original_name);
      }
    }

    original_name = null;
  };

  const start_focus_polling = () => {
    if (focus_check_interval) return;

    focus_check_interval = setInterval(() => {
      if (is_window_active()) {
        clear_badge();
      }
    }, 1000);
  };

  const stop_focus_polling = () => {
    if (focus_check_interval) {
      clearInterval(focus_check_interval);
      focus_check_interval = null;
    }
  };

  // Track when agent starts working
  pi.on("agent_start", async () => {
    clear_badge();
    start_time = Date.now();
  });

  // Badge the window when agent finishes
  pi.on("agent_end", async () => {
    if (start_time === null) return;

    const duration = Date.now() - start_time;
    start_time = null;

    if (duration < MIN_DURATION_MS) return;

    // Always play sound
    play_sound();

    // Only badge if user is on a different window
    if (is_window_active()) return;

    add_badge();
  });

  // Clear badge when user sends a new prompt
  pi.on("input", async () => {
    clear_badge();
    return { action: "continue" as const };
  });

  // Clean up on exit
  pi.on("session_shutdown", async () => {
    clear_badge();
  });
}
