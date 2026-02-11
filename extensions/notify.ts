/**
 * Desktop Notification Extension
 *
 * Sends a native desktop notification when the agent finishes and is waiting
 * for input. Uses OSC 777 escape sequence - no external dependencies.
 * Only notifies if processing took longer than the configured threshold.
 *
 * Supported terminals: Ghostty, iTerm2, WezTerm, rxvt-unicode
 * Not supported: Kitty (uses OSC 99), Terminal.app, Windows Terminal, Alacritty
 * 
 * forked from: https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/notify.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Markdown, type MarkdownTheme } from "@mariozechner/pi-tui";
import { homedir } from "os";

/** Minimum duration in ms before sending notification */
const MIN_DURATION_MS = 1000;

/**
 * Send a desktop notification via OSC 777 escape sequence.
 */
const notify = (title: string, body: string): void => {
  // OSC 777 format: ESC ] 777 ; notify ; title ; body BEL
  process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
};

const is_text_part = (part: unknown): part is { type: "text"; text: string } =>
  Boolean(part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part);

const extract_last_assistant_text = (messages: Array<{ role?: string; content?: unknown }>): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") {
      continue;
    }

    const content = message.content;

    if (typeof content === "string") {
      return content.trim() || null;
    }

    if (Array.isArray(content)) {
      const text = content.filter(is_text_part).map((part) => part.text).join("\n").trim();
      return text || null;
    }

    return null;
  }

  return null;
};

const plain_markdown_theme: MarkdownTheme = {
  heading: (text) => text,
  link: (text) => text,
  linkUrl: () => "",
  code: (text) => text,
  codeBlock: (text) => text,
  codeBlockBorder: () => "",
  quote: (text) => text,
  quoteBorder: () => "",
  hr: () => "",
  listBullet: () => "",
  bold: (text) => text,
  italic: (text) => text,
  strikethrough: (text) => text,
  underline: (text) => text,
};

const simple_markdown = (text: string, width = 80): string => {
  const md = new Markdown(text, 0, 0, plain_markdown_theme);
  return md.render(width).join("\n");
};

const format_path = (cwd: string): string => {
  const home = homedir();
  if (cwd === home) return "~";
  if (cwd.startsWith(home + "/")) return "~" + cwd.slice(home.length);
  return cwd;
};

const format_notification = (text: string | null, cwd: string): { title: string; body: string } => {
  const path = format_path(cwd);
  const simplified = text ? simple_markdown(text) : "";
  const normalized = simplified.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { title: `π ${path}`, body: "Waiting for input" };
  }

  const max_body = 200;
  const body = normalized.length > max_body ? `${normalized.slice(0, max_body - 1)}…` : normalized;
  return { title: `π ${path}`, body };
};

export default function(pi: ExtensionAPI) {
  let start_time: number | null = null;

  pi.on("agent_start", async () => {
    start_time = Date.now();
  });

  pi.on("agent_end", async (event, ctx) => {
    if (start_time === null) return;

    const duration = Date.now() - start_time;
    start_time = null;

    if (duration < MIN_DURATION_MS) return;

    const last_text = extract_last_assistant_text(event.messages ?? []);
    const { title, body } = format_notification(last_text, ctx.cwd);
    notify(title, body);
  });
}
