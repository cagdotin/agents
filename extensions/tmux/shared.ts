import { execSync } from "node:child_process";

/** Check if we're running inside tmux */
export const is_tmux = (): boolean => {
	return !!process.env.TMUX;
};

/** Run a tmux command, swallowing errors */
export const tmux = (cmd: string): string => {
	try {
		return execSync(`tmux ${cmd}`, { encoding: "utf-8", timeout: 2000 }).trim();
	} catch {
		return "";
	}
};

/** Safely escape a string for use in tmux commands */
export const escape_tmux = (str: string): string => {
	return str.replace(/'/g, "'\\''");
};
