/**
 * Tmux Pane Title Extension
 *
 * Sets the tmux pane title to show project name, model, session title,
 * and agent status so you can distinguish multiple pi instances at a glance.
 *
 * Pane border shows:
 *   π qraiter · opus-4-6 · fix login bug        (idle, with session title)
 *   π* qraiter · opus-4-6 · fix login bug       (agent working)
 *   π qraiter · opus-4-6                         (no session title)
 *
 * Non-pi panes fall back to:
 *   qraiter · zsh
 *   qraiter · nvim
 *
 * Requires pane-border-format in tmux.conf to reference #{@pi_title}:
 *
 *   set -g pane-border-format "#{?pane_active, \
 *     #[fg=#cba6f7]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} , \
 *     #[fg=#45475a]  #{pane_index}: #{?#{@pi_title},#{@pi_title},#{b:pane_current_path} · #{pane_current_command}} }"
 *
 * How it works:
 *   The extension stores the title in a tmux pane user option (@pi_title)
 *   rather than the pane_title variable. This is because applications (like
 *   pi's Ink TUI) can overwrite pane_title via terminal escape sequences on
 *   resize/zoom events. User options are internal to tmux and immune to this.
 *
 *   The pane-border-format checks if @pi_title is set: if yes, display it;
 *   otherwise fall back to showing the directory name and current command.
 *
 * Setup:
 *   1. Install the extension (auto-discovered from this repo's package)
 *   2. Add the pane-border-format above to your ~/.tmux.conf
 *      (adjust colors to match your theme)
 *   3. Run `tmux source-file ~/.tmux.conf` to reload
 *
 * Requirements:
 * - Running inside tmux
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename } from "node:path";

const MARKER = "π";
const MAX_SESSION_TITLE_LEN = 30;

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

/** Safely escape a string for use in tmux commands */
const escape_tmux = (str: string): string => {
  return str.replace(/'/g, "'\\''");
};

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
const shorten_model = (id: string): string => {
  let short = id;
  // Remove date suffixes like -20250514
  short = short.replace(/-\d{8}$/, "");
  // Remove "claude-" prefix (provider context is implicit)
  short = short.replace(/^claude-/, "");
  return short;
};

/** Truncate a string with ellipsis if it exceeds max length */
const truncate = (str: string, max: number): string => {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
};

export default function (pi: ExtensionAPI) {
  if (!is_tmux()) return;

  // Capture pane ID at startup — stable, unique to our pane.
  // All tmux queries use -t with this ID so they target the correct pane
  // even when the user is focused on a different one.
  const pane_id = tmux("display-message -p '#{pane_id}'");
  if (!pane_id) return;

  const project_name = basename(process.cwd());
  let model_name = "";
  let is_working = false;

  /**
   * Get a display name for the current session.
   * Prefers explicit session name, falls back to first user message.
   */
  const get_session_title = (ctx?: { sessionManager: { getBranch(): any[] } }): string | undefined => {
    // Prefer explicitly set name
    const name = pi.getSessionName();
    if (name) return name;

    // Fall back to first user message text (same as pi's session selector)
    if (!ctx) return undefined;
    try {
      for (const entry of ctx.sessionManager.getBranch()) {
        if (
          entry.type === "message" &&
          entry.message?.role === "user" &&
          Array.isArray(entry.message.content)
        ) {
          const text_part = entry.message.content.find(
            (c: any) => c.type === "text"
          );
          if (text_part?.text) {
            // Take first line, clean up whitespace
            const first_line = text_part.text.split("\n")[0].trim();
            if (first_line) return first_line;
          }
        }
      }
    } catch {
      // Ignore errors reading session
    }
    return undefined;
  };

  /** Build and set the pane title */
  const update_title = (ctx?: { sessionManager: { getBranch(): any[] } }) => {
    const status_icon = is_working ? `${MARKER}*` : MARKER;
    const model_part = model_name ? ` · ${model_name}` : "";

    const session_title = get_session_title(ctx);
    const session_part = session_title
      ? ` · ${truncate(session_title, MAX_SESSION_TITLE_LEN)}`
      : "";

    const title = `${status_icon} ${project_name}${model_part}${session_part}`;
    const escaped = escape_tmux(title);
    // Use a pane user option instead of pane_title — immune to
    // application escape sequences that reset the title on resize/zoom.
    tmux(`set-option -p -t '${pane_id}' @pi_title '${escaped}'`);
    // Force tmux to redraw borders so the title is visible immediately
    tmux("refresh-client");
  };

  /** Clear the pane title (reset to empty so format falls back) */
  const clear_title = () => {
    tmux(`set-option -p -u -t '${pane_id}' @pi_title`);
    tmux("refresh-client");
  };

  // Set initial title on session start
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.model) {
      model_name = shorten_model(ctx.model.id);
    }
    update_title(ctx);
  });

  // Update model name when model changes
  pi.on("model_select", async (_event, ctx) => {
    model_name = shorten_model(_event.model.id);
    update_title(ctx);
  });

  // Re-read session name after switching/forking sessions
  pi.on("session_switch", async (_event, ctx) => {
    update_title(ctx);
  });

  pi.on("session_fork", async (_event, ctx) => {
    update_title(ctx);
  });

  // Show working indicator when agent starts
  pi.on("agent_start", async (_event, ctx) => {
    is_working = true;
    update_title(ctx);
  });

  // Refresh title when agent finishes — session name may have been
  // set during the turn (e.g. by another extension or the user)
  pi.on("agent_end", async (_event, ctx) => {
    is_working = false;
    update_title(ctx);
  });

  // Reset pane title on exit so pane falls back to dir · command
  pi.on("session_shutdown", async () => {
    clear_title();
  });
}
