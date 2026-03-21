import os from "node:os";
import path from "node:path";
import type { PathRule } from "./types.js";

const GLOB_CHARS_PATTERN = /[*?]/;

const DELETE_COMMAND_PATTERN =
	/\b(rm|rmdir|mv|git\s+clean|git\s+rm|aws\s+s3\s+rm|aws\s+s3\s+rb|terminate-instances|delete-db-instance|delete-stack|delete-table|delete-cluster|delete-function|projects\s+delete|drop\s+table|drop\s+database|truncate\s+table)\b/i;

// Mutation commands that don't rely on redirect detection
const MUTATION_COMMAND_PATTERN =
	/(^|\s)(sed\s+-i|perl\s+-i|tee\s+|truncate\s+|chmod\s+|chown\s+|cp\s+|mv\s+|mkdir\s+|touch\s+|cat\s+.+>)(\s|$)|\binstall\b\s+-/i;

// Safe redirect patterns to strip before checking for dangerous > / >>
// Matches: N>/dev/null, &>/dev/null, N>&M, >&N (fd-to-fd redirects)
const SAFE_REDIRECT_PATTERN = /\d*>&\d+|\d*&?>\/dev\/null/g;

// After stripping safe redirects, any remaining > or >> is a real file redirect
const DANGEROUS_REDIRECT_PATTERN = />{1,2}/;

export function normalize_path(value: string): string {
	return value.replace(/\\/g, "/");
}

export function expand_home(value: string): string {
	if (value === "~") {
		return os.homedir();
	}
	if (value.startsWith("~/")) {
		return path.join(os.homedir(), value.slice(2));
	}
	return value;
}

function has_glob(pattern: string): boolean {
	return GLOB_CHARS_PATTERN.test(pattern);
}

function escape_regex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function glob_to_regex(glob_pattern: string): RegExp {
	let regex = "^";

	for (let index = 0; index < glob_pattern.length; index += 1) {
		const char = glob_pattern[index];
		const next = glob_pattern[index + 1];

		if (char === "*" && next === "*") {
			regex += ".*";
			index += 1;
			continue;
		}
		if (char === "*") {
			regex += "[^/]*";
			continue;
		}
		if (char === "?") {
			regex += "[^/]";
			continue;
		}
		regex += escape_regex(char);
	}

	regex += "$";
	return new RegExp(regex);
}

function to_match_targets(target_path: string, cwd: string): { absolute: string; relative: string; basename: string } {
	const absolute = normalize_path(path.resolve(cwd, expand_home(target_path)));
	const relative = normalize_path(path.relative(cwd, absolute) || ".");
	const basename = path.posix.basename(absolute);
	return { absolute, relative, basename };
}

export function path_rule_matches_target(target_path: string, rule: PathRule, cwd: string): boolean {
	const raw_pattern = rule.pattern.trim();
	if (!raw_pattern) return false;

	const expanded_pattern = normalize_path(expand_home(raw_pattern));
	const targets = to_match_targets(target_path, cwd);

	if (has_glob(expanded_pattern)) {
		const regex = glob_to_regex(expanded_pattern);
		if (regex.test(targets.absolute) || regex.test(targets.relative)) {
			return true;
		}
		if (!expanded_pattern.includes("/") && regex.test(targets.basename)) {
			return true;
		}
		return false;
	}

	if (expanded_pattern.endsWith("/")) {
		const base = expanded_pattern.slice(0, -1);
		const absolute_dir = path.posix.normalize(path.isAbsolute(base) ? base : normalize_path(path.resolve(cwd, base)));
		return targets.absolute === absolute_dir || targets.absolute.startsWith(`${absolute_dir}/`);
	}

	if (path.isAbsolute(expanded_pattern)) {
		const absolute_pattern = path.posix.normalize(expanded_pattern);
		return targets.absolute === absolute_pattern;
	}

	if (expanded_pattern.includes("/")) {
		return targets.relative === expanded_pattern || targets.relative.startsWith(`${expanded_pattern}/`);
	}

	return targets.basename === expanded_pattern || targets.relative === expanded_pattern;
}

export function command_mentions_path_rule(command: string, rule: PathRule, cwd: string): boolean {
	const normalized_command = normalize_path(command).toLowerCase();
	const raw_pattern = rule.pattern.trim();
	if (!raw_pattern) return false;

	const expanded_pattern = normalize_path(expand_home(raw_pattern));
	const probes = new Set<string>();
	probes.add(expanded_pattern.toLowerCase());

	if (expanded_pattern.endsWith("/")) {
		probes.add(expanded_pattern.slice(0, -1).toLowerCase());
	}

	const basename = path.posix.basename(expanded_pattern.replace(/\/$/, ""));
	if (basename) probes.add(basename.toLowerCase());

	if (!path.isAbsolute(expanded_pattern)) {
		const resolved = normalize_path(path.resolve(cwd, expanded_pattern));
		probes.add(resolved.toLowerCase());
	}

	for (const probe of probes) {
		if (probe.length < 3) continue;
		if (normalized_command.includes(probe)) return true;
	}

	return false;
}

export function is_bash_delete_operation(command: string): boolean {
	return DELETE_COMMAND_PATTERN.test(command);
}

export function is_bash_mutation_operation(command: string): boolean {
	if (is_bash_delete_operation(command)) return true;
	if (MUTATION_COMMAND_PATTERN.test(command)) return true;
	// Check for real file redirects (>, >>) after stripping safe ones (2>/dev/null, 2>&1, etc.)
	const without_safe = command.replace(SAFE_REDIRECT_PATTERN, "");
	return DANGEROUS_REDIRECT_PATTERN.test(without_safe);
}

export function truncate_preview(value: string, max_length = 200): string {
	const single_line = value.replace(/\s+/g, " ").trim();
	if (single_line.length <= max_length) return single_line;
	return `${single_line.slice(0, max_length - 1)}…`;
}
