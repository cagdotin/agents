import { execSync } from "node:child_process";

/** Run a cmux command, swallowing errors. Returns stdout trimmed. */
export function cmux(cmd: string): string {
	try {
		return execSync(`cmux ${cmd}`, { encoding: "utf-8", timeout: 3000, stdio: ["pipe", "pipe", "pipe"] }).trim();
	} catch {
		return "";
	}
}

/** Run a cmux command and parse JSON output. Returns null on failure. */
export function cmux_json<T = any>(cmd: string): T | null {
	try {
		const out = execSync(`cmux --json ${cmd}`, {
			encoding: "utf-8",
			timeout: 3000,
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return JSON.parse(out) as T;
	} catch {
		return null;
	}
}

/** Safely escape a string for use in shell commands */
export function escape_shell(str: string): string {
	return str.replace(/'/g, "'\\''");
}
